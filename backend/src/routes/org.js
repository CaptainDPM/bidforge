const express = require("express");
const { query } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const PLANS = {
  trial:      { label: "Trial",      price: 0,    seats: 3,   api_limit: 10  },
  starter:    { label: "Starter",    price: 99,   seats: 5,   api_limit: 50  },
  pro:        { label: "Pro",        price: 299,  seats: 15,  api_limit: 200 },
  enterprise: { label: "Enterprise", price: null, seats: 999, api_limit: 999 },
};

// ── GET /org ──────────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT o.*,
              (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id) as user_count,
              (SELECT COUNT(*) FROM projects p WHERE p.org_id = o.id) as project_count
       FROM organizations o WHERE o.id = $1`,
      [req.orgId]
    );
    res.json({ org: rows[0], plans: PLANS });
  } catch (err) {
    res.status(500).json({ error: "Failed to load org" });
  }
});

// ── GET /org/usage ────────────────────────────────────────────────────────────
router.get("/usage", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ul.action, ul.created_at, ul.tokens_used,
              u.full_name, u.email,
              p.name as project_name
       FROM usage_log ul
       JOIN users u ON u.id = ul.user_id
       LEFT JOIN projects p ON p.id = ul.project_id
       WHERE ul.org_id = $1
       ORDER BY ul.created_at DESC
       LIMIT 200`,
      [req.orgId]
    );
    res.json({ usage: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load usage" });
  }
});

// ── POST /org/upgrade ─────────────────────────────────────────────────────────
// Stub — wire to Stripe in production
router.post("/upgrade", requireAuth, requireAdmin, async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: "Invalid plan" });

  // TODO: Create Stripe checkout session and redirect
  // For now, just update directly (for testing)
  await query(
    `UPDATE organizations SET plan = $1, seats = $2, api_limit = $3 WHERE id = $4`,
    [plan, PLANS[plan].seats, PLANS[plan].api_limit, req.orgId]
  );

  res.json({ success: true, plan: PLANS[plan] });
});

// ── PATCH /org ────────────────────────────────────────────────────────────────
router.patch("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    await query("UPDATE organizations SET name = $1 WHERE id = $2", [name, req.orgId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

module.exports = router;
