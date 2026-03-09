/**
 * cron.js — Monthly usage reset
 *
 * Run this as a scheduled job on the 1st of each month at midnight UTC.
 *
 * Railway cron setup:
 *   1. In your Railway project → Add Service → Cron Job
 *   2. Command:  node src/cron.js
 *   3. Schedule: 0 0 1 * *   (midnight UTC, 1st of every month)
 *
 * Or run manually anytime: node src/cron.js
 */

require("dotenv").config();
const { query, pool } = require("./db");

async function resetMonthlyUsage() {
  console.log(`[${new Date().toISOString()}] Running monthly usage reset…`);

  try {
    // Reset usage counter for all orgs
    // Stripe-paying orgs also get reset via the invoice.payment_succeeded webhook,
    // but this catches trial orgs and any edge cases
    const result = await query(
      `UPDATE organizations
       SET api_calls_this_month = 0
       WHERE api_calls_this_month > 0`
    );

    console.log(`✅ Reset usage for ${result.rowCount} organization(s)`);

    // Log the reset event
    await query(
      `INSERT INTO usage_log (org_id, user_id, action)
       SELECT id, (SELECT id FROM users WHERE org_id = organizations.id AND role = 'owner' LIMIT 1), 'monthly_reset'
       FROM organizations
       WHERE (SELECT id FROM users WHERE org_id = organizations.id LIMIT 1) IS NOT NULL`
    ).catch(() => {}); // Non-critical, don't fail if this errors

  } catch (err) {
    console.error("❌ Monthly reset failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log("Done.");
  process.exit(0);
}

resetMonthlyUsage();
