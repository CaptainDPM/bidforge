// ─── routes/sam.js ────────────────────────────────────────────────────────────
const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { searchOpportunities, getOpportunityDetail } = require("../services/sam");

const router = express.Router();

// ── GET /sam/profile ──────────────────────────────────────────────────────────
// Get this org's SAM search profile (NAICS codes, set-aside prefs)
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT sam_profile FROM organizations WHERE id = $1",
      [req.orgId]
    );
    const profile = rows[0]?.sam_profile || null;
    res.json({ profile: profile ? JSON.parse(profile) : { naicsCodes: [], setAside: "", keywords: "" } });
  } catch (err) {
    console.error("SAM profile error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// ── POST /sam/profile ─────────────────────────────────────────────────────────
// Save this org's SAM search profile
router.post("/profile", requireAuth, async (req, res) => {
  try {
    const { naicsCodes = [], setAside = "", keywords = "" } = req.body;
    const profile = JSON.stringify({ naicsCodes, setAside, keywords });
    await query(
      "UPDATE organizations SET sam_profile = $1 WHERE id = $2",
      [profile, req.orgId]
    );
    res.json({ success: true, profile: { naicsCodes, setAside, keywords } });
  } catch (err) {
    console.error("SAM profile save error:", err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// ── GET /sam/opportunities ────────────────────────────────────────────────────
// Search SAM.gov using org's saved profile, or query params
router.get("/opportunities", requireAuth, async (req, res) => {
  try {
    if (!process.env.SAM_API_KEY) {
      return res.status(503).json({ error: "SAM.gov integration not configured" });
    }

    // Load org profile as defaults
    const { rows } = await query(
      "SELECT sam_profile FROM organizations WHERE id = $1",
      [req.orgId]
    );
    const profile = rows[0]?.sam_profile ? JSON.parse(rows[0].sam_profile) : {};

    // Allow query params to override profile
    const naicsCodes = req.query.naics
      ? req.query.naics.split(",").map(s => s.trim()).filter(Boolean)
      : (profile.naicsCodes || []);

    const setAside  = req.query.setAside  || profile.setAside  || "";
    const keyword   = req.query.keyword   || profile.keywords  || "";
    const limit     = Math.min(parseInt(req.query.limit  || "20"), 50);
    const offset    = parseInt(req.query.offset || "0");

    const result = await searchOpportunities({ naicsCodes, setAside, keyword, limit, offset });
    res.json(result);
  } catch (err) {
    console.error("SAM search error:", err);
    res.status(500).json({ error: err.message || "SAM.gov search failed" });
  }
});

// ── GET /sam/opportunities/:noticeId ─────────────────────────────────────────
// Get a single opportunity's full detail
router.get("/opportunities/:noticeId", requireAuth, async (req, res) => {
  try {
    if (!process.env.SAM_API_KEY) {
      return res.status(503).json({ error: "SAM.gov integration not configured" });
    }
    const opp = await getOpportunityDetail(req.params.noticeId);
    res.json({ opportunity: opp });
  } catch (err) {
    console.error("SAM detail error:", err);
    res.status(500).json({ error: err.message || "Failed to load opportunity" });
  }
});

module.exports = router;
