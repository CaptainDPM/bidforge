const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { query, withTransaction } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { sendWelcome, sendInvite, sendPasswordReset } = require("../services/email");

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  // Registration is locked during beta. Set ALLOW_REGISTRATION=true in env to open it.
  if (process.env.ALLOW_REGISTRATION !== "true") {
    return res.status(403).json({ error: "Registration is currently by invitation only. Contact us to request access." });
  }

  try {
    const { email, password, fullName, orgName } = req.body;
    if (!email || !password || !fullName || !orgName) {
      return res.status(400).json({ error: "email, password, fullName, orgName are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + uuidv4().slice(0, 6);

    const result = await withTransaction(async (client) => {
      const orgRes = await client.query(
        `INSERT INTO organizations (name, slug, plan, seats, api_limit)
         VALUES ($1, $2, 'trial', 3, 10) RETURNING id`,
        [orgName, slug]
      );
      const orgId = orgRes.rows[0].id;
      const userRes = await client.query(
        `INSERT INTO users (org_id, email, password_hash, full_name, role, is_verified)
         VALUES ($1, $2, $3, $4, 'owner', true) RETURNING id, email, full_name, role`,
        [orgId, email.toLowerCase(), passwordHash, fullName]
      );
      return { user: userRes.rows[0], orgId };
    });

    sendWelcome({ to: email, fullName, orgName }).catch((e) =>
      console.error("Welcome email failed:", e.message)
    );

    const token = signToken(result.user.id);
    res.status(201).json({ token, user: result.user });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });

    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.password_hash, u.org_id,
              o.name as org_name, o.plan, o.api_calls_this_month, o.api_limit, o.seats
       FROM users u JOIN organizations o ON o.id = u.org_id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = rows[0];
    await query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
    await query("INSERT INTO usage_log (org_id, user_id, action) VALUES ($1, $2, 'login')", [user.org_id, user.id]);

    const token = signToken(user.id);
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// ── POST /auth/forgot-password ────────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });

    const { rows } = await query(
      "SELECT id, full_name, email FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    // Always return success — don't reveal whether the email exists
    if (rows.length) {
      const user = rows[0];
      const resetToken = uuidv4();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await query(
        "UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3",
        [resetToken, resetExpires, user.id]
      );

      sendPasswordReset({ to: user.email, fullName: user.full_name, resetToken }).catch((e) =>
        console.error("Reset email failed:", e.message)
      );
    }

    res.json({ message: "If that email is registered, you'll receive a reset link shortly." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// ── POST /auth/reset-password ─────────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "token and password required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const { rows } = await query(
      "SELECT id, reset_expires FROM users WHERE reset_token = $1",
      [token]
    );

    if (!rows.length || new Date(rows[0].reset_expires) < new Date()) {
      return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await query(
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL, is_verified = true WHERE id = $2",
      [passwordHash, rows[0].id]
    );

    res.json({ message: "Password set. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Password reset failed" });
  }
});

// ── POST /auth/change-password ────────────────────────────────────────────────
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "currentPassword and newPassword required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, req.user.id]);
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Password change failed" });
  }
});

// ── POST /auth/invite ─────────────────────────────────────────────────────────
router.post("/invite", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, fullName, role = "member" } = req.body;
    if (!email || !fullName) return res.status(400).json({ error: "email and fullName required" });

    const { rows: countRows } = await query(
      "SELECT COUNT(*) as cnt FROM users WHERE org_id = $1",
      [req.orgId]
    );
    if (parseInt(countRows[0].cnt) >= req.user.seats) {
      return res.status(400).json({ error: `Seat limit (${req.user.seats}) reached. Upgrade your plan.` });
    }

    // Generate a readable temp password to hand off manually (since email may not be configured)
    const tempPassword = uuidv4().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const { rows } = await query(
      `INSERT INTO users (org_id, email, password_hash, full_name, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, full_name, role`,
      [req.orgId, email.toLowerCase(), passwordHash, fullName, role]
    );

    // Try to send invite email — but don't fail if email isn't configured yet
    sendInvite({
      to: email,
      fullName,
      inviterName: req.user.full_name,
      orgName: req.user.org_name,
      resetToken: null,
    }).catch((e) => console.log("Invite email skipped (email not configured):", e.message));

    // Always return the temp password so you can share it manually
    res.status(201).json({
      user: rows[0],
      tempPassword,
      message: `Account created for ${email}. Share the temp password with them directly.`,
    });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered" });
    console.error("Invite error:", err);
    res.status(500).json({ error: "Invite failed" });
  }
});

// ── GET /auth/team ────────────────────────────────────────────────────────────
router.get("/team", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, email, full_name, role, is_verified, last_login, created_at
       FROM users WHERE org_id = $1 ORDER BY created_at ASC`,
      [req.orgId]
    );
    res.json({ team: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load team" });
  }
});

// ── DELETE /auth/team/:userId ─────────────────────────────────────────────────
router.delete("/team/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) return res.status(400).json({ error: "Cannot remove yourself" });
    await query("DELETE FROM users WHERE id = $1 AND org_id = $2", [userId, req.orgId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove user" });
  }
});

module.exports = router;
