const express = require("express");
const { query } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { sendUpgradeConfirmation } = require("../services/email");

const router = express.Router();

// Stripe price IDs — create these in your Stripe dashboard
// Dashboard → Products → Add product → Add price (recurring, monthly)
// Then paste the price IDs here
const STRIPE_PRICES = {
  starter:    process.env.STRIPE_PRICE_STARTER    || "price_starter_placeholder",
  pro:        process.env.STRIPE_PRICE_PRO         || "price_pro_placeholder",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE  || "price_enterprise_placeholder",
};

const PLAN_META = {
  starter:    { label: "Starter",    seats: 5,   api_limit: 50  },
  pro:        { label: "Pro",        seats: 15,  api_limit: 200 },
  enterprise: { label: "Enterprise", seats: 999, api_limit: 999 },
};

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

// ── POST /billing/checkout ────────────────────────────────────────────────────
// Creates a Stripe Checkout session and returns the URL to redirect to
router.post("/checkout", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLAN_META[plan]) return res.status(400).json({ error: "Invalid plan" });

    const stripe = getStripe();
    const { rows } = await query(
      "SELECT * FROM organizations WHERE id = $1",
      [req.orgId]
    );
    const org = rows[0];

    // Create or retrieve Stripe customer
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: org.name,
        metadata: { org_id: req.orgId },
      });
      customerId = customer.id;
      await query(
        "UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2",
        [customerId, req.orgId]
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: STRIPE_PRICES[plan], quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/billing?success=1&plan=${plan}`,
      cancel_url:  `${process.env.FRONTEND_URL}/billing?cancelled=1`,
      metadata: { org_id: req.orgId, plan, user_id: req.user.id },
      subscription_data: {
        metadata: { org_id: req.orgId, plan },
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: err.message || "Failed to create checkout session" });
  }
});

// ── POST /billing/portal ──────────────────────────────────────────────────────
// Opens Stripe Customer Portal so users can manage/cancel their subscription
router.post("/portal", requireAuth, requireAdmin, async (req, res) => {
  try {
    const stripe = getStripe();
    const { rows } = await query(
      "SELECT stripe_customer_id FROM organizations WHERE id = $1",
      [req.orgId]
    );
    const customerId = rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: "No billing account found" });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err);
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

// ── GET /billing/status ───────────────────────────────────────────────────────
router.get("/status", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT plan, seats, api_limit, api_calls_this_month, stripe_customer_id FROM organizations WHERE id = $1",
      [req.orgId]
    );
    res.json({ billing: rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to load billing status" });
  }
});

// ── POST /billing/webhook ─────────────────────────────────────────────────────
// Stripe calls this endpoint after successful payments, cancellations, etc.
// IMPORTANT: This route uses raw body parsing (configured in server.js)
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      // ── Payment succeeded — upgrade the org ────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const { org_id, plan } = session.metadata || {};
        if (!org_id || !plan || !PLAN_META[plan]) break;

        const meta = PLAN_META[plan];
        await query(
          `UPDATE organizations
           SET plan = $1, seats = $2, api_limit = $3,
               stripe_subscription_id = $4
           WHERE id = $5`,
          [plan, meta.seats, meta.api_limit, session.subscription, org_id]
        );

        // Email the owner
        const { rows } = await query(
          "SELECT u.email, u.full_name FROM users u WHERE u.org_id = $1 AND u.role = 'owner' LIMIT 1",
          [org_id]
        );
        if (rows.length) {
          await sendUpgradeConfirmation({
            to: rows[0].email,
            fullName: rows[0].full_name,
            planLabel: meta.label,
            seats: meta.seats,
            apiLimit: meta.api_limit,
          }).catch(console.error);
        }
        console.log(`✅ Upgraded org ${org_id} to ${plan}`);
        break;
      }

      // ── Subscription cancelled or payment failed — downgrade ───────────────
      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const obj = event.data.object;
        const orgId = obj.metadata?.org_id;
        if (!orgId) break;

        await query(
          `UPDATE organizations SET plan = 'trial', seats = 3, api_limit = 10 WHERE id = $1`,
          [orgId]
        );
        console.log(`⚠️ Downgraded org ${orgId} to trial`);
        break;
      }

      // ── Subscription renewed ───────────────────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const orgId = invoice.subscription_details?.metadata?.org_id;
        if (orgId) {
          // Reset monthly usage counter on successful renewal
          await query(
            "UPDATE organizations SET api_calls_this_month = 0 WHERE id = $1",
            [orgId]
          );
          console.log(`🔄 Reset usage counter for org ${orgId}`);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

module.exports = router;
