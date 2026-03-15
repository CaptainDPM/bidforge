const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { query, withTransaction } = require("../db");

const router = express.Router();

// ── Admin key middleware ───────────────────────────────────────────────────────
// All admin routes require the ADMIN_SECRET header to match the env var.
// Set ADMIN_SECRET to a long random string in Railway env vars.
function requireAdminKey(req, res, next) {
  const key = req.headers["x-admin-secret"];
  if (!key || key !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ── POST /admin/provision ─────────────────────────────────────────────────────
// Creates a brand new org + owner account for a beta user.
// Usage:
//   curl -X POST https://bidforge-production.up.railway.app/admin/provision \
//     -H "Content-Type: application/json" \
//     -H "x-admin-secret: YOUR_ADMIN_SECRET" \
//     -d '{"email":"user@company.com","fullName":"Jane Smith","orgName":"Smith LLC","apiLimit":3}'
router.post("/provision", requireAdminKey, async (req, res) => {
  try {
    const { email, fullName, orgName, apiLimit = 3 } = req.body;
    if (!email || !fullName || !orgName) {
      return res.status(400).json({ error: "email, fullName, and orgName are required" });
    }

    // Check if email already exists
    const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const tempPassword = uuidv4().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + uuidv4().slice(0, 6);

    const result = await withTransaction(async (client) => {
      // Create org
      const orgRes = await client.query(
        `INSERT INTO organizations (name, slug, plan, seats, api_limit)
         VALUES ($1, $2, 'trial', 3, $3) RETURNING id`,
        [orgName, slug, apiLimit]
      );
      const orgId = orgRes.rows[0].id;

      // Create owner user
      const userRes = await client.query(
        `INSERT INTO users (org_id, email, password_hash, full_name, role, is_verified)
         VALUES ($1, $2, $3, $4, 'owner', true) RETURNING id, email, full_name, role`,
        [orgId, email.toLowerCase(), passwordHash, fullName]
      );

      return { user: userRes.rows[0], orgId };
    });

    res.status(201).json({
      message: `Beta account created for ${email}`,
      email,
      tempPassword,
      orgName,
      apiLimit,
      note: "Share the tempPassword directly with the user. They can change it after logging in.",
    });
  } catch (err) {
    console.error("Provision error:", err);
    res.status(500).json({ error: "Provisioning failed" });
  }
});

// ── GET /admin/orgs ───────────────────────────────────────────────────────────
// Lists all orgs and their usage — useful for monitoring beta users.
router.get("/orgs", requireAdminKey, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT o.id, o.name, o.plan, o.api_calls_this_month, o.api_limit, o.created_at,
              COUNT(u.id) as user_count,
              COUNT(p.id) as project_count
       FROM organizations o
       LEFT JOIN users u ON u.org_id = o.id
       LEFT JOIN projects p ON p.org_id = o.id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );
    res.json({ orgs: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load orgs" });
  }
});

// ── PATCH /admin/orgs/:orgId ──────────────────────────────────────────────────
// Adjust an org's plan, api_limit, or seats — useful for extending a beta user's quota.
router.patch("/orgs/:orgId", requireAdminKey, async (req, res) => {
  try {
    const { plan, apiLimit, seats } = req.body;
    const { rows } = await query(
      `UPDATE organizations
       SET plan = COALESCE($1, plan),
           api_limit = COALESCE($2, api_limit),
           seats = COALESCE($3, seats)
       WHERE id = $4 RETURNING *`,
      [plan, apiLimit, seats, req.params.orgId]
    );
    if (!rows.length) return res.status(404).json({ error: "Org not found" });
    res.json({ org: rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to update org" });
  }
});

// ── DELETE /admin/orgs/:orgId ─────────────────────────────────────────────────
// Removes a beta org and all associated data.
router.delete("/orgs/:orgId", requireAdminKey, async (req, res) => {
  try {
    await query("DELETE FROM organizations WHERE id = $1", [req.params.orgId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete org" });
  }
});

// ── POST /admin/migrate ───────────────────────────────────────────────────────
router.post("/migrate", requireAdminKey, async (req, res) => {
  try {
    await query("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sam_profile TEXT");
    res.json({ success: true, message: "Migration complete" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
