import { useState, useRef, useEffect, useCallback } from "react";
import { api, saveToken, clearToken, hasToken } from "./api";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = ({ d, size = 17, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const P = {
  upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  check:  "M20 6L9 17l-5-5",
  x:      "M18 6L6 18M6 6l12 12",
  doc:    "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6",
  dl:     "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  star:   "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  trash:  "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  plus:   "M12 5v14M5 12h14",
  zap:    "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  copy:   "M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8l-4-4H8zM8 4v4h8",
  eye:    "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
  arrow:  "M5 12h14M12 5l7 7-7 7",
  warn:   "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  home:   "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  users:  "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  edit:   "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#09090f", surface: "#0f0f1a", border: "#191926", border2: "#222232",
  gold: "#c8a96e", goldLight: "#e8c98e", text: "#ddddd5", muted: "#888",
  dim: "#666", green: "#4caf7d", red: "#e05c5c", blue: "#7b8fc8",
};

const S = {
  app:    { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" },
  hdr:    { borderBottom: `1px solid ${C.border}`, padding: "12px 24px", display: "flex", alignItems: "center", gap: 8, background: "rgba(9,9,15,0.97)", backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap" },
  logo:   { fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 20, fontWeight: 700, color: C.gold, letterSpacing: "-0.02em", flexShrink: 0 },
  main:   { flex: 1, padding: "28px 22px", maxWidth: 1160, margin: "0 auto", width: "100%", boxSizing: "border-box" },
  card:   { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 13, padding: 22, marginBottom: 16 },
  h1:     { fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 5, lineHeight: 1.2 },
  h2:     { fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 18, fontWeight: 600, color: C.gold, marginBottom: 12 },
  label:  { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.dim, fontWeight: 700, marginBottom: 7, display: "block" },
  inp:    { width: "100%", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  btn:    { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.18s", flexShrink: 0 },
  gold:   { background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, color: C.bg },
  ghost:  { background: "rgba(255,255,255,0.04)", color: C.muted, border: `1px solid ${C.border2}` },
  danger: { background: "rgba(224,92,92,0.1)", color: C.red, border: `1px solid rgba(224,92,92,0.2)` },
  tab:    (a) => ({ padding: "6px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: a ? "rgba(200,169,110,0.13)" : "transparent", color: a ? C.gold : C.dim, transition: "all 0.18s" }),
  th:     { padding: "9px 13px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.dim, borderBottom: `1px solid ${C.border}`, background: C.bg },
  td:     { padding: "10px 13px", borderBottom: `1px solid #111120`, fontSize: 12 },
  stat:   { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" },
  err:    { background: "rgba(224,92,92,0.08)", border: "1px solid rgba(224,92,92,0.2)", borderRadius: 8, padding: "10px 13px", color: C.red, fontSize: 13, marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 8 },
};

const Badge = ({ text, color = C.gold }) => (
  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: `${color}20`, color, border: `1px solid ${color}40` }}>{text}</span>
);

const Err = ({ msg }) => msg ? (
  <div style={S.err}><Ic d={P.warn} size={14} color={C.red} /><span>{msg}</span></div>
) : null;

function FileZone({ label, hint, onFile, file, required }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const bc = drag ? C.gold : file ? C.green : required ? "rgba(123,143,200,0.5)" : C.border2;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => !file && ref.current.click()}
      style={{ border: `2px dashed ${bc}`, borderRadius: 10, padding: "14px 12px", cursor: file ? "default" : "pointer", background: file ? "rgba(76,175,125,0.04)" : "rgba(255,255,255,0.01)", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 10, minHeight: 68 }}
    >
      <input ref={ref} type="file" accept=".txt,.md,.pdf,.docx,.doc" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      <div style={{ width: 32, height: 32, borderRadius: 8, background: file ? "rgba(76,175,125,0.18)" : "rgba(200,169,110,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Ic d={file ? P.check : P.upload} size={15} color={file ? C.green : C.gold} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: file ? "#ccc" : "#777", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file ? file.name : <>{label}{required && <span style={{ color: C.red }}> *</span>}</>}
        </div>
        <div style={{ fontSize: 11, color: C.dim }}>{file ? `${(file.size / 1024).toFixed(1)} KB` : hint}</div>
      </div>
      {file && <button onClick={(e) => { e.stopPropagation(); onFile(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: 4 }}><Ic d={P.x} size={12} /></button>}
    </div>
  );
}

function Steps({ labels, current }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 28 }}>
      {labels.map((l, i) => (
        <div key={l} style={{ display: "flex", alignItems: "center", flex: i < labels.length - 1 ? 1 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: i < current ? C.green : i === current ? C.gold : "#1a1a26", border: `2px solid ${i < current ? C.green : i === current ? C.gold : "#252535"}`, transition: "all 0.3s", flexShrink: 0 }}>
              {i < current ? <Ic d={P.check} size={12} color="#fff" /> : <span style={{ fontSize: 10, fontWeight: 700, color: i === current ? C.bg : C.dim }}>{i + 1}</span>}
            </div>
            <span style={{ fontSize: 10, color: i === current ? C.gold : i < current ? C.green : C.dim, fontWeight: 600, whiteSpace: "nowrap" }}>{l}</span>
          </div>
          {i < labels.length - 1 && <div style={{ flex: 1, height: 2, margin: "0 5px", marginBottom: 18, background: i < current ? "#4caf7d30" : "#1a1a26" }} />}
        </div>
      ))}
    </div>
  );
}

function LoginScreen({ onAuth, initialMode }) {
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("token")) return "reset";
    return initialMode || "login";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const resetToken = new URLSearchParams(window.location.search).get("token");

  const submit = async () => {
    setErr(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "login") {
        const result = await api.auth.login(email, password);
        saveToken(result.token); onAuth(result.user);
      } else if (mode === "register") {
        if (!fullName || !orgName) { setErr("All fields required"); return; }
        const result = await api.auth.register({ email, password, fullName, orgName });
        saveToken(result.token); onAuth(result.user);
      } else if (mode === "forgot") {
        await api.auth.forgotPassword(email);
        setSuccess("Check your email for a reset link. It expires in 1 hour.");
      } else if (mode === "reset") {
        if (newPassword.length < 8) { setErr("Password must be at least 8 characters"); return; }
        await api.auth.resetPassword(resetToken, newPassword);
        window.history.replaceState({}, "", window.location.pathname);
        setMode("login"); setSuccess("Password set! You can now sign in.");
      }
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  const onKey = (e) => { if (e.key === "Enter") submit(); };
  const go = (m) => { setMode(m); setErr(""); setSuccess(""); };
  const titles = {
    login:    { h: "Welcome back",        sub: "Sign in to your BidForge workspace" },
    register: { h: "Create your account", sub: "Start your free trial — no credit card required" },
    forgot:   { h: "Reset your password", sub: "We'll email you a reset link" },
    reset:    { h: "Set new password",    sub: "Choose a strong password for your account" },
  };
  const { h, sub } = titles[mode] || titles.login;

  return (
    <div style={{ ...S.app, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "0 20px", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg,${C.gold},#8b6914)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ic d={P.zap} size={18} color={C.bg} />
            </div>
            <span style={S.logo}>BidForge</span>
          </div>
          <div style={{ fontFamily: "'Crimson Pro',Georgia,serif", fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 6 }}>{h}</div>
          <div style={{ fontSize: 13, color: C.muted }}>{sub}</div>
        </div>
        <div style={S.card}>
          <Err msg={err} />
          {success && <div style={{ background: "rgba(76,175,125,0.08)", border: "1px solid rgba(76,175,125,0.2)", borderRadius: 8, padding: "10px 13px", color: C.green, fontSize: 13, marginBottom: 14 }}>{success}</div>}
          {mode === "register" && (<>
            <div style={{ marginBottom: 14 }}><label style={S.label}>Full Name</label><input style={S.inp} placeholder="Derek Marquart" value={fullName} onChange={(e) => setFullName(e.target.value)} onKeyDown={onKey} /></div>
            <div style={{ marginBottom: 14 }}><label style={S.label}>Company / Organization</label><input style={S.inp} placeholder="Marquart IT Solutions LLC" value={orgName} onChange={(e) => setOrgName(e.target.value)} onKeyDown={onKey} /></div>
          </>)}
          {(mode === "login" || mode === "register" || mode === "forgot") && (
            <div style={{ marginBottom: 14 }}><label style={S.label}>Email</label><input style={S.inp} type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKey} /></div>
          )}
          {(mode === "login" || mode === "register") && (
            <div style={{ marginBottom: mode === "login" ? 8 : 20 }}><label style={S.label}>Password</label><input style={S.inp} type="password" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKey} /></div>
          )}
          {mode === "login" && <div style={{ textAlign: "right", marginBottom: 16 }}><button onClick={() => go("forgot")} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 12 }}>Forgot password?</button></div>}
          {mode === "reset" && <div style={{ marginBottom: 20 }}><label style={S.label}>New Password</label><input style={S.inp} type="password" placeholder="Min 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={onKey} autoFocus /></div>}
          <button onClick={submit} disabled={loading} style={{ ...S.btn, ...S.gold, width: "100%", justifyContent: "center", padding: "12px", fontSize: 14, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Please wait…" : { login: "Sign In", register: "Create Account", forgot: "Send Reset Link", reset: "Set Password" }[mode]}
          </button>
        </div>
        <div style={{ textAlign: "center", fontSize: 13, color: C.muted, marginTop: 14 }}>
          {mode === "login" && <>Don't have an account? <Lnk onClick={() => go("register")}>Sign up free</Lnk></>}
          {mode === "register" && <>Already have an account? <Lnk onClick={() => go("login")}>Sign in</Lnk></>}
          {(mode === "forgot" || mode === "reset") && <Lnk onClick={() => go("login")}>← Back to sign in</Lnk>}
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "#333", marginTop: 20 }}>
          <a href="/terms.html" style={{ color: "#333", textDecoration: "none" }} target="_blank">Terms of Service</a>{" · "}
          <a href="/privacy.html" style={{ color: "#333", textDecoration: "none" }} target="_blank">Privacy Policy</a>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const Lnk = ({ onClick, children }) => (
  <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", color: C.gold, fontWeight: 600 }}>{children}</button>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [screen, setScreen] = useState("home");
  const [projects, setProjects] = useState([]);
  const [active, setActive] = useState(null);
  const [projsLoading, setProjsLoading] = useState(false);
  const [rfpFile, setRfpFile] = useState(null);
  const [capsFile, setCapsFile] = useState(null);
  const [ppFile, setPpFile] = useState(null);
  const [rfpText, setRfpText] = useState("");
  const [projName, setProjName] = useState("");
  const [coName, setCoName] = useState("");
  const [solType, setSolType] = useState("rfp_federal");
  const [solGroups, setSolGroups] = useState({});
  const [step, setStep] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [streamText, setStreamText] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("matrix");
  const [copied, setCopied] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);

  useEffect(() => {
    if (!hasToken()) { setAuthLoading(false); return; }
    api.auth.me().then((d) => setUser(d.user)).catch(() => clearToken()).finally(() => setAuthLoading(false));
  }, []);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setProjsLoading(true);
    try { const d = await api.projects.list(); setProjects(d.projects || []); } catch {}
    finally { setProjsLoading(false); }
  }, [user]);

  useEffect(() => { if (user) loadProjects(); }, [user, loadProjects]);
  useEffect(() => { api.projects.solicitationTypes().then((d) => setSolGroups(d.groups || {})).catch(() => {}); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      window.history.replaceState({}, "", window.location.pathname);
      api.auth.me().then((d) => setUser(d.user)).catch(() => {});
      setScreen("billing");
    }
  }, []);

  const logout = () => { clearToken(); setUser(null); setProjects([]); setActive(null); setScreen("home"); };

  const run = () => {
    if (!rfpFile && !rfpText.trim()) { setErr("Upload an RFP or paste the text."); return; }
    if (!capsFile) { setErr("Company capabilities document is required."); return; }
    if (!projName.trim()) { setErr("Enter a project name."); return; }
    const fd = new FormData();
    fd.append("projectName", projName.trim());
    fd.append("companyName", coName.trim() || user?.org_name || "Our Company");
    fd.append("solicitationType", solType);
    if (rfpFile) fd.append("rfp", rfpFile); else fd.append("rfpText", rfpText);
    fd.append("capabilities", capsFile);
    if (ppFile) fd.append("pastPerformance", ppFile);
    setErr(""); setScreen("analyzing"); setStep(0); setStreamText("");
    let proposal = "";
    const cleanup = api.projects.analyze(fd, {
      onStep:  ({ step: s, label }) => { setStep(s); setStepLabel(label); },
      onChunk: (delta) => { proposal += delta; setStreamText((t) => t + delta); },
      onDone:  async ({ project }) => {
        await loadProjects();
        const full = await api.projects.get(project.id);
        setActive(full); setTab("matrix");
        setTimeout(() => setScreen("results"), 300);
      },
      onError: (msg) => { setErr(msg); setScreen("upload"); },
    });
    return cleanup;
  };

  const reqs = active?.requirements || [];
  const cnt = {
    full:    reqs.filter((r) => r.status === "Fully Addressed").length,
    partial: reqs.filter((r) => r.status === "Partially Addressed").length,
    none:    reqs.filter((r) => r.status === "Not Addressed").length,
    tbc:     reqs.filter((r) => r.status === "To Be Confirmed").length,
  };
  const score = active?.project?.compliance_score ?? (reqs.length ? Math.round((cnt.full * 100 + cnt.partial * 50) / reqs.length) : 0);
  const scoreColor = score >= 75 ? C.green : score >= 50 ? C.gold : C.red;
  const goHome   = () => setScreen("home");
  const goUpload = () => { setRfpFile(null); setCapsFile(null); setPpFile(null); setRfpText(""); setProjName(""); setCoName(""); setErr(""); setScreen("upload"); };

  if (authLoading) return (
    <div style={{ ...S.app, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.gold, animation: "spin 0.9s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!user) return <LoginScreen onAuth={(u) => setUser(u)} />;

  const Header = ({ children }) => (
    <header style={S.hdr}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg,${C.gold},#8b6914)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Ic d={P.zap} size={13} color={C.bg} />
      </div>
      <span style={S.logo}>BidForge</span>
      {children}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: C.muted }}>{user.full_name} · <span style={{ color: C.gold }}>{user.plan}</span></span>
        <button onClick={() => setScreen("team")} style={{ ...S.btn, ...S.ghost, padding: "5px 10px", fontSize: 11 }}>
          <Ic d={P.users} size={12} /> Team
        </button>
        <button onClick={() => setScreen("billing")} style={{ ...S.btn, ...S.ghost, padding: "5px 10px", fontSize: 11 }}>
          <Ic d={P.star} size={12} /> {user.plan === "trial" ? "Upgrade" : "Billing"}
        </button>
        <button onClick={logout} style={{ ...S.btn, ...S.ghost, padding: "5px 10px", fontSize: 11 }}>
          <Ic d={P.logout} size={12} /> Logout
        </button>
      </div>
    </header>
  );

  if (screen === "home") return (
    <div style={S.app}>
      <Header />
      <div style={S.main}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ ...S.h1, marginBottom: 4 }}>Your Projects</h1>
            <div style={{ fontSize: 13, color: C.muted }}>
              {user.api_calls_this_month} of {user.api_limit} analyses used this month · {user.org_name}
            </div>
          </div>
          <button onClick={goUpload} style={{ ...S.btn, ...S.gold }}>
            <Ic d={P.plus} size={14} color={C.bg} /> New Analysis
          </button>
        </div>
        <div style={{ marginBottom: 28 }}>
          <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (user.api_calls_this_month / user.api_limit) * 100)}%`, background: `linear-gradient(90deg,${C.gold},${C.goldLight})`, borderRadius: 2 }} />
          </div>
        </div>
        {projsLoading ? (
          <div style={{ textAlign: "center", padding: 60, color: C.muted }}>Loading projects…</div>
        ) : projects.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "60px 24px" }}>
            <div style={{ fontFamily: "'Crimson Pro',Georgia,serif", fontSize: 22, color: C.muted, marginBottom: 10 }}>No projects yet</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Upload your first RFP to get started.</div>
            <button onClick={goUpload} style={{ ...S.btn, ...S.gold, padding: "12px 24px" }}>
              <Ic d={P.plus} size={14} color={C.bg} /> Start New Analysis
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {projects.map((p) => {
              const sc = p.compliance_score ?? 0;
              const col = sc >= 75 ? C.green : sc >= 50 ? C.gold : C.red;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(200,169,110,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ic d={P.doc} size={16} color={C.gold} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#ccc", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.company_name} · {p.req_count} reqs · {p.created_by_name} · {new Date(p.created_at).toLocaleDateString()}
                      {p.solicitation_type && <span style={{ marginLeft: 6, padding: "1px 6px", background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.15)", borderRadius: 4, color: "rgba(200,169,110,0.6)", fontSize: 10 }}>{p.solicitation_type.replace(/_/g," ").toUpperCase()}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "center", flexShrink: 0, minWidth: 44 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: col, fontFamily: "'Crimson Pro',Georgia,serif", lineHeight: 1 }}>{sc}%</div>
                    <div style={{ fontSize: 10, color: C.muted }}>score</div>
                  </div>
                  <button onClick={async () => { const d = await api.projects.get(p.id); setActive(d); setTab("matrix"); setScreen("results"); }} style={{ ...S.btn, ...S.ghost, padding: "6px 12px", fontSize: 12 }}>
                    <Ic d={P.eye} size={12} /> View
                  </button>
                  <button onClick={async () => { await api.projects.delete(p.id); loadProjects(); }} style={{ ...S.btn, ...S.danger, padding: "6px 9px" }}>
                    <Ic d={P.trash} size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (screen === "upload") return (
    <div style={S.app}>
      <Header><span style={{ fontSize: 12, color: C.dim, marginLeft: 4 }}>/ New Project</span></Header>
      <div style={{ ...S.main, maxWidth: 720 }}>
        <Steps labels={["Upload", "Extract", "Summarize", "Themes", "Draft"]} current={0} />
        <h1 style={{ ...S.h1, marginBottom: 4 }}>New Proposal Analysis</h1>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 22 }}>
          Upload your solicitation and capabilities. <strong style={{ color: C.blue }}>Plain text (.txt) works best.</strong> PDFs and DOCX are extracted server-side.
        </p>
        <div style={S.card}>
          <div style={{ marginBottom: 18 }}>
            <label style={S.label}>Solicitation Type *</label>
            <div style={{ position: "relative" }}>
              <select value={solType} onChange={(e) => setSolType(e.target.value)} style={{ ...S.inp, appearance: "none", WebkitAppearance: "none", paddingRight: 36, cursor: "pointer" }}>
                {Object.entries(solGroups).length === 0 ? (
                  <option value="rfp_federal">RFP — Federal (FAR-based)</option>
                ) : (
                  Object.entries(solGroups).map(([group, items]) => (
                    <optgroup key={group} label={`── ${group} ──`}>
                      {items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </optgroup>
                  ))
                )}
              </select>
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke={C.dim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            {solGroups && Object.values(solGroups).flat().find((i) => i.value === solType) && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 5, paddingLeft: 2 }}>
                {Object.values(solGroups).flat().find((i) => i.value === solType)?.description}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><label style={S.label}>Project Name *</label><input style={S.inp} placeholder="e.g. VETS 2 — Boeing Sub" value={projName} onChange={(e) => setProjName(e.target.value)} /></div>
            <div><label style={S.label}>Company Name</label><input style={S.inp} placeholder={user.org_name} value={coName} onChange={(e) => setCoName(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Solicitation Document *</label>
            <FileZone label="Drop document here or click to browse" hint="PDF, DOCX, TXT, MD — extracted server-side" onFile={setRfpFile} file={rfpFile} required />
          </div>
          {!rfpFile && (
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Or paste solicitation text</label>
              <textarea style={{ ...S.inp, minHeight: 100, resize: "vertical", lineHeight: 1.6 }} placeholder="Paste the full solicitation text here…" value={rfpText} onChange={(e) => setRfpText(e.target.value)} />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div>
              <label style={S.label}>Company Capabilities *</label>
              <FileZone label="Capabilities statement" hint="Required — PDF, DOCX, TXT" onFile={setCapsFile} file={capsFile} required />
              <div style={{ fontSize: 10, color: "rgba(200,169,110,0.5)", marginTop: 5 }}>Required for compliance scoring &amp; win themes</div>
            </div>
            <div>
              <label style={S.label}>Past Performance <span style={{ color: C.muted, fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 11 }}>(optional)</span></label>
              <FileZone label="Past performance docs" hint="CPARS, case studies, project summaries" onFile={setPpFile} file={ppFile} />
            </div>
          </div>
          <Err msg={err} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={goHome} style={{ ...S.btn, ...S.ghost }}><Ic d={P.home} size={13} /> Back</button>
            <button onClick={run} style={{ ...S.btn, ...S.gold, flex: 1, justifyContent: "center", padding: "12px", fontSize: 14 }}>
              <Ic d={P.star} size={15} color={C.bg} /> Analyze &amp; Generate Response <Ic d={P.arrow} size={14} color={C.bg} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (screen === "analyzing") return (
    <div style={S.app}>
      <Header />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ maxWidth: 560, width: "100%" }}>
          <Steps labels={["Extract", "Summarize", "Themes", "Draft", "Save"]} current={step} />
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.gold, animation: "spin 0.9s linear infinite", margin: "0 auto 16px" }} />
            <div style={{ fontFamily: "'Crimson Pro',Georgia,serif", fontSize: 22, color: "#ccc", marginBottom: 5 }}>Analyzing your documents…</div>
            <div style={{ fontSize: 12, color: C.muted }}>{stepLabel}</div>
          </div>
          {streamText && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, maxHeight: 150, overflow: "hidden", position: "relative" }}>
              <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Generating proposal…</div>
              <div style={{ color: "#555", fontSize: 11, lineHeight: 1.6 }}>{streamText.slice(-350)}</div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: `linear-gradient(transparent,${C.surface})` }} />
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (screen === "results" && active) {
    const proposal = active.proposal || "";
    const execSummary = active.execSummary || "";
    const winThemes = active.winThemes || [];
    const project = active.project || {};
    return (
      <div style={S.app}>
        <Header>
          <span style={{ fontSize: 12, color: C.dim, margin: "0 3px" }}>/</span>
          <span style={{ fontSize: 12, color: "#666", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {[["matrix","Matrix"],["proposal","Proposal"],["summary","Exec Summary"],["themes","Win Themes"]].map(([t,l]) => (
              <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
            ))}
          </div>
          <button onClick={() => api.projects.exportCSV(project.id, project.name)} style={{ ...S.btn, ...S.ghost, padding: "6px 11px", fontSize: 11 }}>
            <Ic d={P.dl} size={12} /> CSV
          </button>
        </Header>
        <div style={{ ...S.main, maxWidth: 1180 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8, marginBottom: 16 }}>
            {[{l:"Score",v:`${score}%`,c:scoreColor},{l:"Total",v:reqs.length,c:"#aaa"},{l:"Fully Met",v:cnt.full,c:C.green},{l:"Partial",v:cnt.partial,c:C.gold},{l:"Gaps",v:cnt.none,c:C.red},{l:"TBC",v:cnt.tbc,c:C.blue}].map(({l,v,c})=>(
              <div key={l} style={S.stat}>
                <div style={{fontSize:22,fontWeight:700,color:c,fontFamily:"'Crimson Pro',Georgia,serif",lineHeight:1}}>{v}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:4,letterSpacing:"0.06em",textTransform:"uppercase"}}>{l}</div>
              </div>
            ))}
          </div>
          {!disclaimerDismissed && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: "rgba(123,143,200,0.07)", border: "1px solid rgba(123,143,200,0.2)", borderRadius: 10, marginBottom: 16 }}>
              <Ic d={P.warn} size={15} color={C.blue} />
              <div style={{ flex: 1, fontSize: 12, color: "#8fa0cc", lineHeight: 1.6 }}>
                <strong style={{ color: C.blue }}>AI-Assisted Content — Review Required.</strong> All AI-generated content must be reviewed and verified by your team before submission. Your organization is solely responsible for accuracy and regulatory compliance.
              </div>
              <button onClick={() => setDisclaimerDismissed(true)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: "2px 4px", flexShrink: 0 }}><Ic d={P.x} size={13} /></button>
            </div>
          )}
          {tab === "matrix" && (
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={S.h2}>Compliance Matrix</div>
                <span style={{fontSize:11,color:C.muted}}>{reqs.length} requirements</span>
              </div>
              <div style={{overflowX:"auto",borderRadius:8,border:`1px solid ${C.border}`}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["ID","Requirement","Category","Priority","Status","Response Strategy","Owner"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {reqs.map((r,i)=>{
                      const sc={"Fully Addressed":C.green,"Partially Addressed":C.gold,"Not Addressed":C.red,"To Be Confirmed":C.blue}[r.status]||"#666";
                      const pc={High:C.red,Medium:C.gold,Low:C.green}[r.priority]||"#666";
                      return(
                        <tr key={r.id||i} style={{background:i%2?"rgba(255,255,255,0.01)":"transparent"}}>
                          <td style={{...S.td,color:C.muted,fontFamily:"monospace",fontSize:11}}>R{String(i+1).padStart(3,"0")}</td>
                          <td style={{...S.td,color:"#bbb",lineHeight:1.5,maxWidth:240}}>{r.requirement}</td>
                          <td style={S.td}><Badge text={r.category} color={C.blue}/></td>
                          <td style={S.td}><Badge text={r.priority||"Med"} color={pc}/></td>
                          <td style={S.td}><Badge text={r.status} color={sc}/></td>
                          <td style={{...S.td,color:C.muted,lineHeight:1.5,maxWidth:220}}>{r.response_strategy}</td>
                          <td style={{...S.td,color:C.muted}}>{r.owner||"TBD"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "proposal" && (
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={S.h2}>Proposal Draft</div>
                <button onClick={()=>{navigator.clipboard.writeText(proposal);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{...S.btn,...S.ghost,padding:"6px 12px",fontSize:12}}>
                  <Ic d={P.copy} size={12}/> {copied?"Copied!":"Copy All"}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", background: "rgba(200,169,110,0.05)", border: "1px solid rgba(200,169,110,0.15)", borderRadius: 8, marginBottom: 14 }}>
                <Ic d={P.warn} size={13} color={C.gold} />
                <span style={{ fontSize: 11, color: "rgba(200,169,110,0.8)", lineHeight: 1.5 }}>This is an AI-generated draft. Review all content carefully before submission.</span>
              </div>
              <div style={{background:C.bg,borderRadius:8,padding:"20px 24px",maxHeight:600,overflowY:"auto",border:`1px solid ${C.border}`}}>
                {proposal.split("\n").map((line,i)=>{
                  if(line.startsWith("## ")) return<h2 key={i} style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:18,color:C.gold,marginTop:24,marginBottom:9,borderBottom:`1px solid ${C.border}`,paddingBottom:6}}>{line.slice(3)}</h2>;
                  if(line.startsWith("# ")) return<h1 key={i} style={{fontFamily:"'Crimson Pro',Georgia,serif",fontSize:22,color:"#d0d0c8",marginBottom:9}}>{line.slice(2)}</h1>;
                  if(!line.trim()) return<br key={i}/>;
                  return<p key={i} style={{color:"#999",lineHeight:1.8,marginBottom:4,fontSize:13}}>{line}</p>;
                })}
              </div>
            </div>
          )}
          {tab === "summary" && (
            <div style={S.card}>
              <div style={S.h2}>Executive Summary</div>
              <div style={{background:C.bg,borderRadius:8,padding:"20px 24px",border:`1px solid ${C.border}`,marginBottom:14}}>
                {execSummary.split("\n").filter(Boolean).map((p,i)=>(
                  <p key={i} style={{color:"#999",lineHeight:1.8,marginBottom:12,fontSize:14}}>{p}</p>
                ))}
              </div>
            </div>
          )}
          {tab === "themes" && (
            <div style={S.card}>
              <div style={S.h2}>Win Themes</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:18}}>
                {winThemes.map((t,i)=>(
                  <div key={i} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"13px 15px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:28,height:28,borderRadius:7,background:"rgba(200,169,110,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:12,fontWeight:700,color:C.gold,fontFamily:"'Crimson Pro',Georgia,serif"}}>{i+1}</span>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:"#bbb"}}>{t}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={goHome} style={{...S.btn,...S.ghost,marginTop:4}}><Ic d={P.home} size={13}/> Back to Projects</button>
        </div>
      </div>
    );
  }

  if (screen === "team") return <TeamScreen user={user} onBack={goHome} />;

  if (screen === "billing") return (
    <div style={S.app}>
      <Header />
      <div style={{ ...S.main, maxWidth: 780 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ ...S.h1, marginBottom: 4 }}>Plans &amp; Billing</h1>
            <div style={{ fontSize: 13, color: C.muted }}>
              Current plan: <strong style={{ color: C.gold }}>{user.plan}</strong> · {user.api_calls_this_month}/{user.api_limit} analyses used this month
            </div>
          </div>
          {user.plan !== "trial" && (
            <button onClick={async () => { const d = await api.billing.portal(); window.location.href = d.url; }} style={{ ...S.btn, ...S.ghost }}>Manage Subscription</button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { key: "starter",    label: "Starter",    price: "$199",  seats: 5,   analyses: 50,  features: ["5 team seats", "50 analyses/mo", "PDF & DOCX extraction", "CSV export", "Email support"] },
            { key: "pro",        label: "Pro",        price: "$499",  seats: 15,  analyses: 200, features: ["15 team seats", "200 analyses/mo", "Everything in Starter", "Priority support", "Usage analytics"], highlight: true },
            { key: "enterprise", label: "Enterprise", price: "Custom",seats: "∞", analyses: "∞", features: ["Unlimited seats", "Unlimited analyses", "Everything in Pro", "Dedicated account mgr", "Custom contract"] },
          ].map(({ key, label, price, seats, analyses, features, highlight }) => {
            const isCurrent = user.plan === key;
            return (
              <div key={key} style={{ background: highlight ? "rgba(200,169,110,0.05)" : C.surface, border: `1px solid ${highlight ? "rgba(200,169,110,0.3)" : C.border}`, borderRadius: 13, padding: 22, display: "flex", flexDirection: "column", position: "relative" }}>
                {highlight && <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, color: C.bg, fontSize: 10, fontWeight: 700, padding: "3px 12px", borderRadius: "0 0 8px 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Most Popular</div>}
                <div style={{ fontFamily: "'Crimson Pro',Georgia,serif", fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4, marginTop: highlight ? 10 : 0 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.gold, fontFamily: "'Crimson Pro',Georgia,serif", marginBottom: 4 }}>{price}<span style={{ fontSize: 13, color: C.muted, fontFamily: "inherit", fontWeight: 400 }}>{price !== "Custom" ? "/mo" : ""}</span></div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>{analyses} analyses · {seats} seats</div>
                <div style={{ flex: 1, marginBottom: 18 }}>
                  {features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#999" }}>
                      <Ic d={P.check} size={12} color={C.green} /> {f}
                    </div>
                  ))}
                </div>
                {isCurrent ? (
                  <div style={{ textAlign: "center", padding: "9px", background: "rgba(76,175,125,0.08)", border: "1px solid rgba(76,175,125,0.2)", borderRadius: 8, fontSize: 12, color: C.green, fontWeight: 600 }}>Current Plan</div>
                ) : (
                  <button onClick={async () => {
                    if (key === "enterprise") { window.location.href = "mailto:sales@bidforge.com?subject=Enterprise Plan Inquiry"; return; }
                    const d = await api.billing.checkout(key); window.location.href = d.url;
                  }} style={{ ...S.btn, ...(highlight ? S.gold : S.ghost), width: "100%", justifyContent: "center" }}>
                    {key === "enterprise" ? "Contact Sales" : `Upgrade to ${label}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {user.plan === "trial" && (
          <div style={{ padding: "14px 18px", background: "rgba(123,143,200,0.07)", border: "1px solid rgba(123,143,200,0.2)", borderRadius: 10, fontSize: 13, color: "#8fa0cc" }}>
            <strong>You're on the free trial.</strong> You have {user.api_limit - user.api_calls_this_month} analyses remaining. Upgrade anytime — no data is lost.
          </div>
        )}
        <button onClick={goHome} style={{ ...S.btn, ...S.ghost, marginTop: 20 }}><Ic d={P.home} size={13} /> Back to Projects</button>
      </div>
    </div>
  );

  return null;
}

// ─── Team Screen ──────────────────────────────────────────────────────────────
function TeamScreen({ user, onBack }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteErr, setInviteErr] = useState("");
  const [inviteResult, setInviteResult] = useState(null);

  useEffect(() => {
    api.auth.team().then((d) => setTeam(d.team || [])).finally(() => setLoading(false));
  }, []);

  const invite = async () => {
    setInviteErr(""); setInviteResult(null);
    try {
      const r = await api.auth.invite({ email: inviteEmail, fullName: inviteName });
      setInviteResult(r); setTeam((t) => [...t, r.user]);
      setInviteEmail(""); setInviteName("");
    } catch (e) { setInviteErr(e.message); }
  };

  return (
    <div style={S.app}>
      <header style={S.hdr}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg,${C.gold},#8b6914)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ic d={P.zap} size={13} color={C.bg} />
        </div>
        <span style={S.logo}>BidForge</span>
        <span style={{ fontSize: 12, color: C.dim, marginLeft: 4 }}>/ Team</span>
        <div style={{ flex: 1 }} />
        <button onClick={onBack} style={{ ...S.btn, ...S.ghost, padding: "5px 10px", fontSize: 11 }}>
          <Ic d={P.home} size={12} /> Back to Projects
        </button>
      </header>
      <div style={{ ...S.main, maxWidth: 640 }}>
        <h1 style={{ ...S.h1, marginBottom: 4 }}>Team Members</h1>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>{user.org_name}</div>
        <div style={S.card}>
          {loading ? (
            <div style={{ color: C.muted, textAlign: "center", padding: 20 }}>Loading…</div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              {team.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(200,169,110,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>{(m.full_name || "?")[0].toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{m.full_name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{m.email}</div>
                  </div>
                  <Badge text={m.role} color={m.role === "owner" ? C.gold : C.blue} />
                </div>
              ))}
            </div>
          )}
        </div>
        {["owner", "admin"].includes(user.role) && (
          <div style={S.card}>
            <div style={{ ...S.h2, marginBottom: 16 }}>Invite Team Member</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={S.label}>Full Name</label><input style={S.inp} placeholder="Jane Smith" value={inviteName} onChange={(e) => setInviteName(e.target.value)} /></div>
              <div><label style={S.label}>Email</label><input style={S.inp} placeholder="jane@company.com" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></div>
            </div>
            {inviteErr && <Err msg={inviteErr} />}
            {inviteResult && (
              <div style={{ fontSize: 12, color: C.green, marginBottom: 12, padding: "10px 13px", background: "rgba(76,175,125,0.08)", border: "1px solid rgba(76,175,125,0.2)", borderRadius: 8 }}>
                Invited! Temp password: <code style={{ background: C.bg, padding: "2px 6px", borderRadius: 4 }}>{inviteResult.tempPassword}</code>
              </div>
            )}
            <button onClick={invite} style={{ ...S.btn, ...S.gold }}>
              <Ic d={P.plus} size={13} color={C.bg} /> Send Invite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
