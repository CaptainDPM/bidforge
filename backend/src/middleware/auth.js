const jwt = require("jsonwebtoken");
const { query } = require("../db");

// Verify JWT and attach user + org to req
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = header.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Load user + org in one query
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.org_id,
              o.name as org_name, o.plan, o.api_calls_this_month, o.api_limit, o.seats
       FROM users u
       JOIN organizations o ON o.id = u.org_id
       WHERE u.id = $1`,
      [payload.userId]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = rows[0];
    req.orgId = rows[0].org_id;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Authentication error" });
  }
}

// Check the org hasn't exceeded its monthly API limit
async function requireApiQuota(req, res, next) {
  const { api_calls_this_month, api_limit } = req.user;
  if (api_calls_this_month >= api_limit) {
    return res.status(429).json({
      error: "Monthly analysis limit reached",
      limit: api_limit,
      used: api_calls_this_month,
      upgrade_url: "/billing",
    });
  }
  next();
}

// Only org owners and admins
function requireAdmin(req, res, next) {
  if (!["owner", "admin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { requireAuth, requireApiQuota, requireAdmin };
