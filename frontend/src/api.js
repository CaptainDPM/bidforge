// api.js — all backend communication lives here

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function getToken() {
  return localStorage.getItem("bidforge_token");
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function handleResponse(resp) {
  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (body) =>
      fetch(`${BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(handleResponse),

    login: (email, password) =>
      fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).then(handleResponse),

    forgotPassword: (email) =>
      fetch(`${BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).then(handleResponse),

    resetPassword: (token, password) =>
      fetch(`${BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      }).then(handleResponse),

    changePassword: (currentPassword, newPassword) =>
      fetch(`${BASE}/auth/change-password`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ currentPassword, newPassword }),
      }).then(handleResponse),

    me: () =>
      fetch(`${BASE}/auth/me`, { headers: authHeaders() }).then(handleResponse),

    invite: (body) =>
      fetch(`${BASE}/auth/invite`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      }).then(handleResponse),

    team: () =>
      fetch(`${BASE}/auth/team`, { headers: authHeaders() }).then(handleResponse),

    removeTeamMember: (userId) =>
      fetch(`${BASE}/auth/team/${userId}`, {
        method: "DELETE",
        headers: authHeaders(),
      }).then(handleResponse),
  },

  // ─── Projects ───────────────────────────────────────────────────────────────
  projects: {
    list: () =>
      fetch(`${BASE}/projects`, { headers: authHeaders() }).then(handleResponse),

    solicitationTypes: () =>
      fetch(`${BASE}/projects/solicitation-types`).then(handleResponse),

    get: (id) =>
      fetch(`${BASE}/projects/${id}`, { headers: authHeaders() }).then(handleResponse),

    delete: (id) =>
      fetch(`${BASE}/projects/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      }).then(handleResponse),

    updateRequirement: (projectId, reqId, body) =>
      fetch(`${BASE}/projects/${projectId}/requirements/${reqId}`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      }).then(handleResponse),

    exportCSV: (id, name) => {
      const link = document.createElement("a");
      link.href = `${BASE}/projects/${id}/export/csv`;
      link.setAttribute("Authorization", `Bearer ${getToken()}`);
      // For auth'd download, we fetch and blob it
      return fetch(`${BASE}/projects/${id}/export/csv`, { headers: authHeaders() })
        .then((r) => r.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `${name}_matrix.csv`; a.click();
          URL.revokeObjectURL(url);
        });
    },

    /**
     * Run the full analysis pipeline via SSE.
     * Returns a cleanup function.
     *
     * callbacks: { onStep, onExtracted, onRequirements, onThemes, onChunk, onDone, onError }
     */
    analyze: (formData, callbacks = {}) => {
      // We can't use EventSource with custom headers, so we use fetch + ReadableStream
      let cancelled = false;

      (async () => {
        try {
          const resp = await fetch(`${BASE}/projects/analyze`, {
            method: "POST",
            headers: authHeaders(), // no Content-Type — multipart handled by browser
            body: formData,
          });

          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
            callbacks.onError?.(err.error || "Analysis failed");
            return;
          }

          const reader = resp.body.getReader();
          const dec = new TextDecoder();
          let buf = "";

          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const parts = buf.split("\n\n");
            buf = parts.pop() ?? "";

            for (const part of parts) {
              const eventLine = part.match(/^event: (.+)$/m)?.[1];
              const dataLine  = part.match(/^data: (.+)$/m)?.[1];
              if (!eventLine || !dataLine) continue;
              try {
                const payload = JSON.parse(dataLine);
                switch (eventLine) {
                  case "step":        callbacks.onStep?.(payload); break;
                  case "extracted":   callbacks.onExtracted?.(payload); break;
                  case "requirements":callbacks.onRequirements?.(payload); break;
                  case "themes":      callbacks.onThemes?.(payload); break;
                  case "chunk":       callbacks.onChunk?.(payload.text); break;
                  case "done":        callbacks.onDone?.(payload); break;
                  case "error":       callbacks.onError?.(payload.message); break;
                }
              } catch {}
            }
          }
        } catch (err) {
          if (!cancelled) callbacks.onError?.(err.message);
        }
      })();

      return () => { cancelled = true; };
    },
  },

  // ─── Billing ────────────────────────────────────────────────────────────────
  billing: {
    status: () =>
      fetch(`${BASE}/billing/status`, { headers: authHeaders() }).then(handleResponse),

    checkout: (plan) =>
      fetch(`${BASE}/billing/checkout`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ plan }),
      }).then(handleResponse),

    portal: () =>
      fetch(`${BASE}/billing/portal`, {
        method: "POST",
        headers: authHeaders(),
      }).then(handleResponse),
  },

  // ─── Org ────────────────────────────────────────────────────────────────────
  org: {
    get: () =>
      fetch(`${BASE}/org`, { headers: authHeaders() }).then(handleResponse),

    usage: () =>
      fetch(`${BASE}/org/usage`, { headers: authHeaders() }).then(handleResponse),

    upgrade: (plan) =>
      fetch(`${BASE}/org/upgrade`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ plan }),
      }).then(handleResponse),
  },

  // ─── SAM.gov ─────────────────────────────────────────────────────────────────
  sam: {
    getProfile: () =>
      fetch(`${BASE}/sam/profile`, { headers: authHeaders() }).then(handleResponse),

    saveProfile: (body) =>
      fetch(`${BASE}/sam/profile`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      }).then(handleResponse),

    search: ({ naics = [], setAside = "", keyword = "", limit = 20, offset = 0 } = {}) => {
      const params = new URLSearchParams();
      if (naics.length) params.set("naics", naics.join(","));
      if (setAside) params.set("setAside", setAside);
      if (keyword) params.set("keyword", keyword);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      return fetch(`${BASE}/sam/opportunities?${params.toString()}`, { headers: authHeaders() }).then(handleResponse);
    },

    getOpportunity: (noticeId) =>
      fetch(`${BASE}/sam/opportunities/${noticeId}`, { headers: authHeaders() }).then(handleResponse),
  },
};

// Token management
export function saveToken(token) { localStorage.setItem("bidforge_token", token); }
export function clearToken() { localStorage.removeItem("bidforge_token"); }
export function hasToken() { return !!localStorage.getItem("bidforge_token"); }
