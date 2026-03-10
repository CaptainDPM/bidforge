const express = require("express");
const multer = require("multer");
const { query, withTransaction } = require("../db");
const { requireAuth, requireApiQuota } = require("../middleware/auth");
const { extractText } = require("../services/extractor");
const { extractRequirements, writeExecSummary, extractWinThemes, draftProposal } = require("../services/claude");
const { SOLICITATION_GROUPS } = require("../services/solicitations");

const router = express.Router();

// Memory storage — files never touch disk, parsed immediately
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".docx", ".doc", ".txt", ".md"];
    const ext = "." + file.originalname.split(".").pop().toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// ── GET /projects/solicitation-types ─────────────────────────────────────────
router.get("/solicitation-types", (req, res) => {
  res.json({ groups: SOLICITATION_GROUPS });
});

// ── GET /projects ─────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.full_name as created_by_name,
              (SELECT COUNT(*) FROM requirements r WHERE r.project_id = p.id) as req_count
       FROM projects p
       JOIN users u ON u.id = p.created_by
       WHERE p.org_id = $1
       ORDER BY p.created_at DESC`,
      [req.orgId]
    );
    res.json({ projects: rows });
  } catch (err) {
    console.error("List projects error:", err);
    res.status(500).json({ error: "Failed to load projects" });
  }
});

// ── GET /projects/:id ─────────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    // Project
    const { rows: proj } = await query(
      "SELECT * FROM projects WHERE id = $1 AND org_id = $2",
      [req.params.id, req.orgId]
    );
    if (!proj.length) return res.status(404).json({ error: "Project not found" });

    // Requirements
    const { rows: reqs } = await query(
      "SELECT * FROM requirements WHERE project_id = $1 ORDER BY req_order ASC",
      [req.params.id]
    );

    // Proposal sections
    const { rows: sections } = await query(
      "SELECT section_key, content FROM proposal_sections WHERE project_id = $1",
      [req.params.id]
    );

    const sectionMap = {};
    sections.forEach((s) => { sectionMap[s.section_key] = s.content; });

    res.json({
      project: proj[0],
      requirements: reqs,
      execSummary: sectionMap.exec_summary || "",
      winThemes: JSON.parse(sectionMap.win_themes || "[]"),
      proposal: sectionMap.full_proposal || "",
    });
  } catch (err) {
    console.error("Get project error:", err);
    res.status(500).json({ error: "Failed to load project" });
  }
});

// ── POST /projects/analyze ────────────────────────────────────────────────────
// Main pipeline: upload docs → extract → generate → save
// Uses SSE so the client sees live step progress
router.post(
  "/analyze",
  requireAuth,
  requireApiQuota,
  upload.fields([
    { name: "rfp", maxCount: 1 },
    { name: "capabilities", maxCount: 1 },
    { name: "pastPerformance", maxCount: 1 },
  ]),
  async (req, res) => {
    // Set up Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const { projectName, companyName, rfpText, solicitationType = "rfp_federal" } = req.body;

      if (!projectName) { send("error", { message: "projectName is required" }); return res.end(); }
      if (!req.files?.capabilities) { send("error", { message: "Capabilities document is required" }); return res.end(); }
      if (!req.files?.rfp && !rfpText) { send("error", { message: "RFP document or text is required" }); return res.end(); }

      const company = (companyName || "Our Company").trim();

      // ── Extract text from files ───────────────────────────────────────────
      send("step", { step: 0, label: "Extracting document text…" });

      const rfpFile = req.files?.rfp?.[0];
      const capsFile = req.files?.capabilities?.[0];
      const ppFile = req.files?.pastPerformance?.[0];

      const [rfpExtracted, capsExtracted, ppExtracted] = await Promise.all([
        rfpFile ? extractText(rfpFile.buffer, rfpFile.originalname) : Promise.resolve({ text: rfpText || "", extractionMethod: "pasted" }),
        extractText(capsFile.buffer, capsFile.originalname),
        ppFile ? extractText(ppFile.buffer, ppFile.originalname) : Promise.resolve({ text: "", extractionMethod: "none" }),
      ]);

      const docs = {
        rfpText: rfpExtracted.text,
        capsText: capsExtracted.text,
        ppText: ppExtracted.text,
        companyName: company,
      };

      send("extracted", {
        rfpWords: rfpExtracted.wordCount,
        capsWords: capsExtracted.wordCount,
        ppWords: ppExtracted.wordCount,
      });

      // ── Requirements ──────────────────────────────────────────────────────
      send("step", { step: 1, label: "Extracting requirements…" });
      const requirements = await extractRequirements(docs, solicitationType);
      send("requirements", { count: requirements.length });

      // ── Executive summary ─────────────────────────────────────────────────
      send("step", { step: 2, label: "Writing executive summary…" });
      const execSummary = await writeExecSummary(docs, requirements, solicitationType);

      // ── Win themes ────────────────────────────────────────────────────────
      send("step", { step: 3, label: "Identifying win themes…" });
      const winThemes = await extractWinThemes(docs, solicitationType);
      send("themes", { themes: winThemes });

      // ── Full proposal (streams chunks to client) ───────────────────────────
      send("step", { step: 4, label: "Drafting response…" });
      let proposal = "";
      await draftProposal(docs, winThemes, requirements, (delta, full) => {
        proposal = full;
        send("chunk", { text: delta });
      }, solicitationType);

      // ── Save to database ──────────────────────────────────────────────────
      send("step", { step: 5, label: "Saving project…" });

      const score = requirements.length
        ? Math.round(
            (requirements.filter((r) => r.status === "Fully Addressed").length * 100 +
             requirements.filter((r) => r.status === "Partially Addressed").length * 50) /
            requirements.length
          )
        : 0;

      const project = await withTransaction(async (client) => {
        // Create project
        const projRes = await client.query(
          `INSERT INTO projects (org_id, created_by, name, company_name, rfp_name, caps_name, pp_name, status, compliance_score, solicitation_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'complete', $8, $9) RETURNING *`,
          [
            req.orgId, req.user.id, projectName.trim(), company,
            rfpFile?.originalname || "Pasted RFP",
            capsFile.originalname,
            ppFile?.originalname || null,
            score,
            solicitationType,
          ]
        );
        const projectId = projRes.rows[0].id;

        // Save requirements
        for (let i = 0; i < requirements.length; i++) {
          const r = requirements[i];
          await client.query(
            `INSERT INTO requirements (project_id, req_order, requirement, category, priority, status, response_strategy, owner)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [projectId, i, r.requirement, r.category, r.priority || "Medium", r.status, r.response_strategy, r.owner || "TBD"]
          );
        }

        // Save sections
        for (const [key, content] of [
          ["exec_summary", execSummary],
          ["win_themes", JSON.stringify(winThemes)],
          ["full_proposal", proposal],
        ]) {
          await client.query(
            `INSERT INTO proposal_sections (project_id, section_key, content)
             VALUES ($1, $2, $3)
             ON CONFLICT (project_id, section_key) DO UPDATE SET content = EXCLUDED.content`,
            [projectId, key, content]
          );
        }

        // Increment usage counter
        await client.query(
          `UPDATE organizations SET api_calls_this_month = api_calls_this_month + 1 WHERE id = $1`,
          [req.orgId]
        );

        // Log usage
        await client.query(
          `INSERT INTO usage_log (org_id, user_id, project_id, action) VALUES ($1, $2, $3, 'analyze')`,
          [req.orgId, req.user.id, projectId]
        );

        return projRes.rows[0];
      });

      send("done", { project, score, requirementCount: requirements.length });
      res.end();

    } catch (err) {
      console.error("Analysis pipeline error:", err);
      send("error", { message: err.message || "Analysis failed" });
      res.end();
    }
  }
);

// ── PATCH /projects/:id/requirements/:reqId ───────────────────────────────────
// Update a single requirement (owner edits status, response_strategy, etc.)
router.patch("/:id/requirements/:reqId", requireAuth, async (req, res) => {
  try {
    const { status, response_strategy, owner, notes, priority } = req.body;

    // Verify project belongs to org
    const { rows: proj } = await query(
      "SELECT id FROM projects WHERE id = $1 AND org_id = $2",
      [req.params.id, req.orgId]
    );
    if (!proj.length) return res.status(404).json({ error: "Project not found" });

    const { rows } = await query(
      `UPDATE requirements
       SET status = COALESCE($1, status),
           response_strategy = COALESCE($2, response_strategy),
           owner = COALESCE($3, owner),
           notes = COALESCE($4, notes),
           priority = COALESCE($5, priority)
       WHERE id = $6 AND project_id = $7
       RETURNING *`,
      [status, response_strategy, owner, notes, priority, req.params.reqId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Requirement not found" });

    // Recalculate and update compliance score
    const { rows: allReqs } = await query(
      "SELECT status FROM requirements WHERE project_id = $1",
      [req.params.id]
    );
    const score = Math.round(
      (allReqs.filter((r) => r.status === "Fully Addressed").length * 100 +
       allReqs.filter((r) => r.status === "Partially Addressed").length * 50) /
      allReqs.length
    );
    await query("UPDATE projects SET compliance_score = $1 WHERE id = $2", [score, req.params.id]);

    res.json({ requirement: rows[0], newScore: score });
  } catch (err) {
    res.status(500).json({ error: "Failed to update requirement" });
  }
});

// ── DELETE /projects/:id ──────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { rowCount } = await query(
      "DELETE FROM projects WHERE id = $1 AND org_id = $2",
      [req.params.id, req.orgId]
    );
    if (!rowCount) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ── GET /projects/:id/export/csv ──────────────────────────────────────────────
router.get("/:id/export/csv", requireAuth, async (req, res) => {
  try {
    const { rows: proj } = await query(
      "SELECT name FROM projects WHERE id = $1 AND org_id = $2",
      [req.params.id, req.orgId]
    );
    if (!proj.length) return res.status(404).json({ error: "Not found" });

    const { rows: reqs } = await query(
      "SELECT * FROM requirements WHERE project_id = $1 ORDER BY req_order",
      [req.params.id]
    );

    const header = ["ID", "Requirement", "Category", "Priority", "Status", "Response Strategy", "Owner", "Notes"];
    const csvRows = reqs.map((r, i) => [
      `R${String(i + 1).padStart(3, "0")}`,
      `"${(r.requirement || "").replace(/"/g, '""')}"`,
      r.category,
      r.priority,
      r.status,
      `"${(r.response_strategy || "").replace(/"/g, '""')}"`,
      r.owner || "TBD",
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [header, ...csvRows].map((r) => r.join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${proj[0].name}_matrix.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
});

module.exports = router;
