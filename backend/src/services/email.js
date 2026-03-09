/**
 * Email service via Resend (resend.com)
 * Free tier: 3,000 emails/month, 100/day
 * Setup: add RESEND_API_KEY and EMAIL_FROM to your .env
 */

const FROM = process.env.EMAIL_FROM || "BidForge <noreply@bidforge.com>";
const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173";

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback — just log the email instead of crashing
    console.log(`\n📧 [EMAIL — no RESEND_API_KEY set]\nTo: ${to}\nSubject: ${subject}\n`);
    return { id: "dev-no-send" };
  }

  const fetch = (await import("node-fetch")).default;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend API error ${resp.status}: ${err}`);
  }
  return resp.json();
}

// ─── Email templates ──────────────────────────────────────────────────────────

function baseLayout(content) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; padding: 0; background: #f4f4f8; font-family: 'Helvetica Neue', Arial, sans-serif; }
  .wrap { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
  .hdr { background: #09090f; padding: 28px 36px; }
  .logo { font-size: 22px; font-weight: 700; color: #c8a96e; letter-spacing: -0.02em; }
  .body { padding: 32px 36px; color: #333; font-size: 15px; line-height: 1.7; }
  .btn { display: inline-block; margin: 20px 0; padding: 13px 28px; background: linear-gradient(135deg,#c8a96e,#e8c98e); color: #09090f !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; }
  .footer { padding: 20px 36px; background: #f9f9fb; border-top: 1px solid #eee; font-size: 12px; color: #999; }
  .divider { border: none; border-top: 1px solid #eee; margin: 24px 0; }
</style></head><body>
<div class="wrap">
  <div class="hdr"><div class="logo">⚡ BidForge</div></div>
  <div class="body">${content}</div>
  <div class="footer">
    BidForge · AI-Powered Proposal Writing<br>
    You're receiving this because you have an account at BidForge.<br>
    If you didn't request this, you can safely ignore this email.
  </div>
</div></body></html>`;
}

// ── Welcome email after registration ─────────────────────────────────────────
async function sendWelcome({ to, fullName, orgName }) {
  await sendEmail({
    to,
    subject: "Welcome to BidForge",
    html: baseLayout(`
      <p>Hi ${fullName},</p>
      <p>Welcome to BidForge! Your workspace for <strong>${orgName}</strong> is ready.</p>
      <p>You're on the <strong>Trial plan</strong> — 10 free analyses to get started. Upload your first RFP and see what BidForge can do.</p>
      <a href="${APP_URL}" class="btn">Open BidForge →</a>
      <hr class="divider">
      <p style="font-size:13px;color:#666;">Questions? Just reply to this email.</p>
    `),
  });
}

// ── Team invite email ─────────────────────────────────────────────────────────
async function sendInvite({ to, fullName, inviterName, orgName, resetToken }) {
  const link = `${APP_URL}/reset-password?token=${resetToken}`;
  await sendEmail({
    to,
    subject: `${inviterName} invited you to BidForge`,
    html: baseLayout(`
      <p>Hi ${fullName},</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on BidForge — an AI-powered proposal writing tool for federal and commercial contractors.</p>
      <p>Click below to set your password and activate your account:</p>
      <a href="${link}" class="btn">Accept Invite & Set Password →</a>
      <hr class="divider">
      <p style="font-size:12px;color:#999;">This link expires in 48 hours. If you weren't expecting this invite, you can safely ignore it.</p>
    `),
  });
}

// ── Password reset email ──────────────────────────────────────────────────────
async function sendPasswordReset({ to, fullName, resetToken }) {
  const link = `${APP_URL}/reset-password?token=${resetToken}`;
  await sendEmail({
    to,
    subject: "Reset your BidForge password",
    html: baseLayout(`
      <p>Hi ${fullName},</p>
      <p>We received a request to reset the password for your BidForge account.</p>
      <a href="${link}" class="btn">Reset Password →</a>
      <hr class="divider">
      <p style="font-size:13px;color:#666;">This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
    `),
  });
}

// ── Plan upgrade confirmation ─────────────────────────────────────────────────
async function sendUpgradeConfirmation({ to, fullName, planLabel, seats, apiLimit }) {
  await sendEmail({
    to,
    subject: `You're now on BidForge ${planLabel}`,
    html: baseLayout(`
      <p>Hi ${fullName},</p>
      <p>Your BidForge workspace has been upgraded to the <strong>${planLabel} plan</strong>.</p>
      <ul style="line-height:2">
        <li><strong>${seats} seats</strong> — invite your team</li>
        <li><strong>${apiLimit} analyses/month</strong></li>
        <li>Full proposal drafting, compliance matrix, CSV export</li>
      </ul>
      <a href="${APP_URL}" class="btn">Go to BidForge →</a>
      <hr class="divider">
      <p style="font-size:13px;color:#666;">Questions about your plan? Reply to this email.</p>
    `),
  });
}

module.exports = { sendWelcome, sendInvite, sendPasswordReset, sendUpgradeConfirmation };
