const { getSolicitation } = require("./solicitations");

const MODEL = "claude-sonnet-4-20250514";

async function claudeCall(system, userPrompt, maxTokens = 4000) {
  const fetch = (await import("node-fetch")).default;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  return (data.content || []).map((b) => b.text || "").join("");
}

async function claudeStream(system, userPrompt, onChunk, maxTokens = 6000) {
  const fetch = (await import("node-fetch")).default;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      stream: true,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${body.slice(0, 300)}`);
  }
  let full = "", buf = "";
  for await (const chunk of resp.body) {
    buf += chunk.toString();
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const ev = JSON.parse(raw);
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
          full += ev.delta.text;
          onChunk(ev.delta.text, full);
        }
      } catch {}
    }
  }
  return full;
}

function parseJSONArray(raw) {
  const attempts = [
    () => JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()),
    () => JSON.parse((raw.match(/\[[\s\S]*?\]/) || [])[0]),
    () => JSON.parse((raw.match(/\[[\s\S]*\]/) || [])[0]),
  ];
  for (const attempt of attempts) {
    try { const v = attempt(); if (Array.isArray(v)) return v; } catch {}
  }
  return null;
}

function buildContext({ rfpText, capsText, ppText, companyName }) {
  return [
    `=== SOLICITATION DOCUMENT ===\n${rfpText.slice(0, 60000)}`,
    `\n=== COMPANY CAPABILITIES ===\n${capsText.slice(0, 30000)}`,
    ppText ? `\n=== PAST PERFORMANCE ===\n${ppText.slice(0, 20000)}` : "",
    `\nCompany name: ${companyName}`,
  ].filter(Boolean).join("\n");
}

// ─── Requirements extraction ──────────────────────────────────────────────────
async function extractRequirements(docs, solicitationType = "rfp_federal") {
  const sol = getSolicitation(solicitationType);
  const context = buildContext(docs);

  const prompt = `${context}

=== SOLICITATION TYPE ===
${sol.label} — ${sol.description}
${sol.requirementsContext}

=== TASK ===
Extract all key requirements from the solicitation above. Cross-reference the capabilities to assess compliance status.

Return ONLY a raw JSON array. No markdown, no code fences, no explanation — just the array.
Each element must have exactly these keys:
  "requirement"       – clear description of the requirement
  "category"          – one of: ${sol.reqCategories.join(", ")}
  "priority"          – one of: High, Medium, Low
  "status"            – one of: Fully Addressed, Partially Addressed, Not Addressed, To Be Confirmed
  "response_strategy" – 1-2 sentence actionable guidance specific to a ${sol.label} response
  "owner"             – "TBD"

Extract 12-20 of the most important requirements. Return the raw JSON array now:`;

  const raw = await claudeCall(
    `${sol.systemPersona} You extract requirements and assess compliance. Return ONLY a raw JSON array — no markdown, no preamble.`,
    prompt
  );

  const reqs = parseJSONArray(raw);
  if (!reqs || !reqs.length) {
    return [{
      requirement: "Requirements extraction failed — check document format",
      category: sol.reqCategories[0],
      priority: "High",
      status: "To Be Confirmed",
      response_strategy: "Re-upload documents as plain text (.txt) files.",
      owner: "TBD",
    }];
  }
  return reqs;
}

// ─── Executive summary ────────────────────────────────────────────────────────
async function writeExecSummary(docs, solicitationType = "rfp_federal") {
  const sol = getSolicitation(solicitationType);
  const context = buildContext(docs);

  const prompt = `${context}

=== SOLICITATION TYPE ===
${sol.label} — ${sol.description}

Write a compelling executive summary for our ${sol.label} response.
${sol.summaryGuidance}
Use active voice. Reference our capabilities directly against the stated requirements.`;

  return claudeCall(sol.systemPersona, prompt);
}

// ─── Win themes ───────────────────────────────────────────────────────────────
async function extractWinThemes(docs, solicitationType = "rfp_federal") {
  const sol = getSolicitation(solicitationType);
  const context = buildContext(docs);

  const prompt = `${context}

=== SOLICITATION TYPE ===
${sol.label}

Identify 5-7 win themes — the key differentiators that make this company the strongest choice for this ${sol.label}.
Consider what evaluators of a ${sol.label} care about most.
Return ONLY a raw JSON array of short strings. No markdown. Example: ["Technical Excellence", "Local Presence", "Proven Experience"]`;

  const raw = await claudeCall(
    `${sol.systemPersona} Return ONLY a raw JSON array of win theme strings.`,
    prompt
  );
  return parseJSONArray(raw) || ["Technical Excellence", "Relevant Experience", "Strong Team", "Value", "Reliability"];
}

// ─── Full proposal draft (streaming) ─────────────────────────────────────────
async function draftProposal(docs, winThemes, onChunk, solicitationType = "rfp_federal") {
  const sol = getSolicitation(solicitationType);
  const context = buildContext(docs);
  const sections = sol.proposalSections.join("\n");

  const prompt = `${context}

=== SOLICITATION TYPE ===
${sol.label} — ${sol.description}

=== WIN THEMES ===
${winThemes.join(", ")}

=== TASK ===
Write a complete, detailed response to this ${sol.label}.
Use ## for section headers. Include ALL of these sections:
${sections}

=== GUIDANCE ===
${sol.sectionGuidance}

Be specific. Reference solicitation requirements by name or number. Show how our capabilities directly satisfy each requirement. Write as if this will be submitted as-is after light editing.`;

  return claudeStream(
    `${sol.systemPersona} Write a professional, detailed, winning ${sol.label} response. Use ## headers for each section.`,
    prompt,
    onChunk,
    6000
  );
}

module.exports = { extractRequirements, writeExecSummary, extractWinThemes, draftProposal };
