require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes    = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const orgRoutes     = require("./routes/org");
const billingRoutes = require("./routes/billing");
const adminRoutes = require("./routes/admin");

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const limiter     = rateLimit({ windowMs: 15*60*1000, max: 100, standardHeaders: true, message: { error: "Too many requests" } });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20,  message: { error: "Too many auth attempts" } });

app.use("/api/auth", authLimiter);
app.use(limiter);

// ⚠️ Stripe webhook MUST receive raw body — mount before express.json()
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/admin", adminRoutes);
app.use("/api/auth",     authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/org",      orgRoutes);
app.use("/api/billing",  billingRoutes);

app.get("/health", (req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File too large (max 20MB)" });
  res.status(500).json({ error: "Internal server error" });
});

app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

app.listen(PORT, () => {
  console.log(`\n🚀 BidForge API — port ${PORT}`);
  console.log(`   Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`   Email:    ${process.env.RESEND_API_KEY ? "✓ Resend" : "⚠ no key — logging only"}`);
  console.log(`   Stripe:   ${process.env.STRIPE_SECRET_KEY ? "✓ configured" : "⚠ no key"}\n`);
});

module.exports = app;
