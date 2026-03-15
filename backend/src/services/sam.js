// ─── services/sam.js ──────────────────────────────────────────────────────────
// SAM.gov Opportunities API wrapper

const SAM_BASE = "https://api.sam.gov/opportunities/v2/search";

async function searchOpportunities({ naicsCodes = [], setAside = "", keyword = "", limit = 20, offset = 0 }) {
  const fetch = (await import("node-fetch")).default;

  const params = new URLSearchParams({
    api_key: process.env.SAM_API_KEY,
    limit: String(limit),
    offset: String(offset),
    postedFrom: getDateDaysAgo(90),
    postedTo: getTodayDate(),
    status: "active",
  });

  if (naicsCodes && naicsCodes.length) {
    params.append("naicsCode", naicsCodes.join(","));
  }
  if (setAside) {
    params.append("typeOfSetAsideDescription", setAside);
  }
  if (keyword) {
    params.append("q", keyword);
  }

  const url = `${SAM_BASE}?${params.toString()}`;
  console.log("SAM.gov query:", url.replace(process.env.SAM_API_KEY, "***"));

  const resp = await fetch(url, {
    headers: { "Accept": "application/json" },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`SAM.gov API ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = await resp.json();
  const opps = (data.opportunitiesData || []).map(normalizeOpp);
  return { opportunities: opps, total: data.totalRecords || 0 };
}

async function getOpportunityDetail(noticeId) {
  const fetch = (await import("node-fetch")).default;
  const url = `https://api.sam.gov/opportunities/v2/search?api_key=${process.env.SAM_API_KEY}&noticeid=${noticeId}&limit=1`;

  const resp = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!resp.ok) throw new Error(`SAM.gov API ${resp.status}`);

  const data = await resp.json();
  const opp = (data.opportunitiesData || [])[0];
  if (!opp) throw new Error("Opportunity not found");
  return normalizeOpp(opp);
}

function normalizeOpp(o) {
  return {
    noticeId:      o.noticeId || o.id || "",
    title:         o.title || "Untitled",
    solicitationNumber: o.solicitationNumber || "",
    agency:        o.fullParentPathName || o.organizationHierarchy?.agency?.name || o.departmentName || "Unknown Agency",
    subAgency:     o.organizationHierarchy?.subAgency?.name || "",
    type:          o.type || "",
    typeLabel:     getTypeLabel(o.type),
    naicsCode:     o.naicsCode || "",
    naicsDesc:     o.naicsDescription || "",
    setAside:      o.typeOfSetAsideDescription || o.typeOfSetAside || "",
    postedDate:    o.postedDate || "",
    responseDeadline: o.responseDeadLine || o.archiveDate || "",
    description:   o.description || "",
    uiLink:        o.uiLink || `https://sam.gov/opp/${o.noticeId}/view`,
    placeOfPerformance: o.placeOfPerformance?.city?.name
      ? `${o.placeOfPerformance.city.name}, ${o.placeOfPerformance.state?.code || ""}`
      : o.placeOfPerformance?.state?.name || "CONUS",
    pointOfContact: (o.pointOfContact || []).map(p => ({
      name:  p.fullName || "",
      email: p.email || "",
      phone: p.phone || "",
    })),
  };
}

function getTypeLabel(type) {
  const map = {
    "o":   "Solicitation",
    "p":   "Presolicitation",
    "k":   "Combined Synopsis",
    "r":   "Sources Sought",
    "g":   "Sale of Surplus",
    "s":   "Special Notice",
    "i":   "Intent to Bundle",
    "a":   "Award Notice",
    "u":   "Justification",
    "j":   "Justification & Approval",
  };
  return map[type?.toLowerCase()] || type || "Notice";
}

function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

function getTodayDate() {
  return formatDate(new Date());
}

function formatDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

module.exports = { searchOpportunities, getOpportunityDetail };
