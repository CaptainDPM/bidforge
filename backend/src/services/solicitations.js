/**
 * solicitations.js
 * Defines every supported solicitation type with:
 *   - label / group / description shown in the UI dropdown
 *   - requirement categories specific to that type
 *   - prompt overrides for requirements, exec summary, win themes, and proposal sections
 */

const SOLICITATION_TYPES = {

  // ── FEDERAL ──────────────────────────────────────────────────────────────

  rfp_federal: {
    label: "RFP — Federal (FAR-based)",
    group: "Federal",
    description: "Request for Proposal under FAR/DFARS. Full technical, management, and price volumes.",
    reqCategories: ["Technical", "Management", "Past Performance", "Pricing", "Compliance", "Staffing", "Deliverable", "Evaluation"],
    systemPersona: "You are an expert federal proposal writer with 20 years of experience winning FAR-based contracts for small businesses, including SDVOSB, 8(a), and HUBZone firms.",
    requirementsContext: "This is a FAR-based federal RFP. Extract all requirements including Section L (instructions) and Section M (evaluation criteria) items. Flag any small business set-aside requirements.",
    summaryGuidance: "Reference FAR compliance, relevant certifications (SDVOSB, 8(a), etc.), and past federal contract performance. Use formal proposal tone.",
    proposalSections: [
      "## Technical Approach",
      "## Management Approach",
      "## Staffing Plan",
      "## Past Performance",
      "## Quality Assurance Plan",
      "## Risk Management",
      "## Price/Cost Approach",
      "## Compliance Matrix Summary",
      "## Conclusion",
    ],
    sectionGuidance: "Structure the response to address Section M evaluation criteria directly. Reference FAR clauses where relevant. Highlight small business certifications prominently.",
  },

  rfq_federal: {
    label: "RFQ — Federal (Simplified Acquisition)",
    group: "Federal",
    description: "Request for Quotation under SAP (under $250K). Simplified format, price-focused.",
    reqCategories: ["Technical", "Pricing", "Compliance", "Deliverable", "Evaluation"],
    systemPersona: "You are a federal contracting specialist experienced with simplified acquisition procedures and GSA Schedule orders.",
    requirementsContext: "This is a federal RFQ under simplified acquisition procedures. Focus on technical acceptability, delivery requirements, and price. Keep extraction concise.",
    summaryGuidance: "Keep it brief and direct. Focus on technical acceptability, competitive pricing, and fast delivery. 2 paragraphs maximum.",
    proposalSections: [
      "## Technical Capability Statement",
      "## Approach & Methodology",
      "## Delivery & Schedule",
      "## Price/Quote",
      "## Company Information & Certifications",
    ],
    sectionGuidance: "RFQ responses should be concise. Lead with price competitiveness and technical acceptability. Include GSA Schedule contract number if applicable.",
  },

  sources_sought: {
    label: "Sources Sought / RFI",
    group: "Federal",
    description: "Market research notice. No award — government is gauging industry capability.",
    reqCategories: ["Technical", "Compliance", "Past Performance", "Staffing"],
    systemPersona: "You are a federal business development expert specializing in market research responses that position companies for future awards.",
    requirementsContext: "This is a Sources Sought notice or RFI. The goal is to demonstrate capability and interest, not to win a contract. Extract the government's stated capability requirements and questions.",
    summaryGuidance: "Position the company as highly capable and interested. Express enthusiasm for the potential requirement. This is a marketing document, not a contract proposal.",
    proposalSections: [
      "## Company Overview & Qualifications",
      "## Technical Capabilities",
      "## Relevant Past Performance",
      "## Small Business Certifications",
      "## Questions & Comments",
      "## Points of Contact",
    ],
    sectionGuidance: "Keep the tone collaborative and informative. Answer every government question directly. Highlight certifications prominently as the government may be planning a set-aside.",
  },

  idiq_task_order: {
    label: "Task Order — IDIQ / GWAC / MAC",
    group: "Federal",
    description: "Task order under an existing IDIQ vehicle (VETS 2, Polaris, OASIS, SeaPort, etc.)",
    reqCategories: ["Technical", "Management", "Staffing", "Pricing", "Past Performance", "Deliverable"],
    systemPersona: "You are a federal task order specialist with deep experience responding to task orders under GWAC and MAC vehicles including VETS 2, Polaris, OASIS, and GSA IT Schedule 70.",
    requirementsContext: "This is a task order RFP/RFQ under an IDIQ contract vehicle. Reference the parent contract's terms. Focus on PWS/SOW requirements, LCAT alignment, and staffing. Note the contract vehicle name if mentioned.",
    summaryGuidance: "Reference the specific contract vehicle. Emphasize existing vehicle holder status, team qualifications, and ability to surge/scale. Highlight relevant past task orders.",
    proposalSections: [
      "## Understanding of the Requirement",
      "## Technical Approach",
      "## Staffing & Key Personnel",
      "## Management Approach",
      "## Past Performance on Similar Task Orders",
      "## Quality Control",
      "## Schedule & Deliverables",
      "## Price/Labor Mix",
    ],
    sectionGuidance: "Reference the PWS/SOW paragraph numbers directly. Propose specific LCATs with hours. Demonstrate understanding of the parent IDIQ vehicle terms and how this task order fits within scope.",
  },

  grant_federal: {
    label: "Federal Grant Application",
    group: "Federal",
    description: "Federal grant (SBIR, STTR, SAM grants, agency-specific). Narrative-heavy.",
    reqCategories: ["Technical", "Management", "Compliance", "Deliverable", "Evaluation", "Past Performance"],
    systemPersona: "You are a federal grant writer specializing in SBIR/STTR applications and agency-specific grant programs, with expertise in technical narratives and budget justifications.",
    requirementsContext: "This is a federal grant application. Extract all required narrative sections, page limits, eligibility requirements, and evaluation criteria. Note any cost-share requirements.",
    summaryGuidance: "Lead with the innovation or public benefit. Demonstrate technical merit, team qualifications, and path to commercialization or impact. Use active, compelling language.",
    proposalSections: [
      "## Project Summary / Abstract",
      "## Problem Statement & Significance",
      "## Technical Approach & Innovation",
      "## Work Plan & Milestones",
      "## Team Qualifications",
      "## Facilities & Resources",
      "## Evaluation & Metrics",
      "## Budget Narrative",
      "## Commercialization / Sustainability Plan",
    ],
    sectionGuidance: "Address every review criterion explicitly. Use headers that mirror the grant application instructions. Be specific about measurable outcomes and milestones.",
  },

  // ── STATE & LOCAL ─────────────────────────────────────────────────────────

  rfp_state: {
    label: "RFP — State Government",
    group: "State & Local",
    description: "State agency RFP. Procurement rules vary by state — not FAR-based.",
    reqCategories: ["Technical", "Management", "Past Performance", "Pricing", "Compliance", "Staffing", "Deliverable", "Evaluation"],
    systemPersona: "You are a state government procurement specialist with experience responding to RFPs across multiple state agencies.",
    requirementsContext: "This is a state government RFP. Extract all requirements including mandatory vs. desirable criteria, local preference requirements, and any state-specific certifications (DVBE, MBE, WBE, SBE) mentioned.",
    summaryGuidance: "Emphasize local presence, state-specific experience, and relevant state agency past performance. Note any applicable state certifications. Use professional but accessible tone.",
    proposalSections: [
      "## Executive Summary",
      "## Understanding of the Requirement",
      "## Technical Approach",
      "## Project Management Approach",
      "## Staffing & Key Personnel",
      "## Relevant Experience & References",
      "## Implementation Timeline",
      "## Cost Proposal",
      "## Required Certifications & Attachments",
    ],
    sectionGuidance: "Address mandatory requirements explicitly — state RFPs are often pass/fail on mandatory items before scoring. Note local/in-state presence if applicable.",
  },

  rfp_county_city: {
    label: "RFP — City / County",
    group: "State & Local",
    description: "Municipal or county RFP. Often informal, relationship-driven, local preference.",
    reqCategories: ["Technical", "Management", "Pricing", "Past Performance", "Compliance", "Deliverable"],
    systemPersona: "You are a municipal procurement specialist experienced with city and county RFPs, understanding local government dynamics and community benefit requirements.",
    requirementsContext: "This is a city or county RFP. Extract all requirements, scoring criteria, local business preference provisions, and any community benefit or local hire requirements.",
    summaryGuidance: "Lead with local presence, community ties, and specific municipal project experience. Local governments value reliability and responsiveness highly.",
    proposalSections: [
      "## Cover Letter & Executive Summary",
      "## Firm Qualifications & Local Presence",
      "## Technical Approach",
      "## Project Team & Key Personnel",
      "## Relevant Project Experience",
      "## Project Schedule",
      "## Fee Proposal",
      "## References",
    ],
    sectionGuidance: "Emphasize local ties, community investment, and responsiveness. City/county evaluators are often non-technical — write clearly and avoid jargon.",
  },

  ifb_public: {
    label: "IFB — Invitation for Bid (Public Works)",
    group: "State & Local",
    description: "Sealed bid for public works / construction. Lowest responsive bid wins.",
    reqCategories: ["Technical", "Compliance", "Pricing", "Staffing", "Deliverable"],
    systemPersona: "You are a public works construction bid specialist with expertise in sealed bid procurement, bonding, prevailing wage, and public works compliance requirements.",
    requirementsContext: "This is an Invitation for Bid (IFB) for public works or construction. Extract all technical specifications, bonding requirements, prevailing wage requirements, insurance minimums, and bid schedule items.",
    summaryGuidance: "IFBs are awarded to the lowest responsive, responsible bidder — there is no narrative scoring. Focus the summary on responsiveness, compliance, and capability to perform.",
    proposalSections: [
      "## Bid Form Completion Notes",
      "## Technical Specifications Compliance",
      "## Subcontractor & DBE Plan",
      "## Bonding & Insurance",
      "## Prevailing Wage Compliance",
      "## Schedule & Phasing",
      "## Safety Plan",
      "## Qualifications & References",
    ],
    sectionGuidance: "IFB responses must be fully responsive to every specification. Flag any exceptions clearly. Prevailing wage and bonding compliance are typically pass/fail.",
  },

  qbs: {
    label: "QBS — Qualifications-Based Selection",
    group: "State & Local",
    description: "A/E and professional services. No price in initial submission — selected on qualifications.",
    reqCategories: ["Technical", "Past Performance", "Staffing", "Management", "Compliance"],
    systemPersona: "You are an A/E and professional services proposal specialist experienced with Brooks Act QBS procedures for architecture, engineering, and related professional services.",
    requirementsContext: "This is a QBS solicitation under Brooks Act or similar state law. Price is NOT evaluated in this phase. Extract all qualification criteria, experience requirements, and evaluation factors.",
    summaryGuidance: "Do NOT mention price or fees — this is a qualifications-only submission. Lead with relevant project experience, team credentials, and approach.",
    proposalSections: [
      "## Firm Overview & Relevant Experience",
      "## Key Personnel & Qualifications",
      "## Project Approach & Technical Methodology",
      "## Relevant Past Projects (SF-330 style)",
      "## Quality Management",
      "## Subconsultant Team",
      "## Capacity & Availability",
      "## Why Our Team",
    ],
    sectionGuidance: "Never mention price in QBS — it disqualifies submissions in many jurisdictions. Use SF-330-style project experience descriptions.",
  },

  // ── COMMERCIAL ────────────────────────────────────────────────────────────

  rfp_commercial: {
    label: "RFP — Commercial / Private Sector",
    group: "Commercial",
    description: "Private company RFP. More flexible format, relationship and value-driven.",
    reqCategories: ["Technical", "Management", "Pricing", "Past Performance", "Staffing", "Deliverable"],
    systemPersona: "You are a commercial proposal specialist with experience winning contracts with Fortune 500 companies, mid-market firms, and private sector clients across industries.",
    requirementsContext: "This is a commercial (private sector) RFP. Extract all stated requirements, evaluation criteria, and any implicit needs. Commercial buyers care about cultural fit, responsiveness, and value.",
    summaryGuidance: "Lead with business outcomes and ROI, not technical features. Commercial buyers want to know: can you solve my problem, do you understand my business, and can I trust you?",
    proposalSections: [
      "## Executive Summary",
      "## Understanding of Your Needs",
      "## Proposed Solution & Approach",
      "## Implementation Plan",
      "## Team & Qualifications",
      "## Relevant Client Experience",
      "## Investment / Pricing",
      "## Why Choose Us",
      "## Next Steps",
    ],
    sectionGuidance: "Use the client's language and terminology from the RFP. Commercial proposals should feel like a conversation, not a government form.",
  },

  rfp_nonprofit_grant: {
    label: "Grant — Foundation / Nonprofit Funder",
    group: "Commercial",
    description: "Private foundation or nonprofit grant application. Mission and impact focused.",
    reqCategories: ["Technical", "Compliance", "Deliverable", "Evaluation", "Management"],
    systemPersona: "You are a nonprofit grant writer with expertise in foundation relations, logic models, and impact-focused narrative writing for private and community foundations.",
    requirementsContext: "This is a private foundation or nonprofit grant application. Extract all required narrative components, budget requirements, reporting obligations, and eligibility criteria. Note word/page limits.",
    summaryGuidance: "Lead with community impact and mission alignment. Foundation funders want to fund change, not organizations. Show clear theory of change, measurable outcomes, and community voice.",
    proposalSections: [
      "## Organization Overview & Mission",
      "## Statement of Need",
      "## Project Description & Theory of Change",
      "## Goals, Objectives & Outcomes",
      "## Implementation Plan",
      "## Evaluation Plan",
      "## Organizational Capacity",
      "## Budget Narrative",
      "## Sustainability Plan",
    ],
    sectionGuidance: "Use data to establish need, stories to establish impact. Every objective should be SMART. Align language directly with the funder's stated priorities.",
  },
};

// Grouped for the frontend dropdown
const SOLICITATION_GROUPS = {
  "Federal": Object.entries(SOLICITATION_TYPES)
    .filter(([, v]) => v.group === "Federal")
    .map(([k, v]) => ({ value: k, label: v.label, description: v.description })),
  "State & Local": Object.entries(SOLICITATION_TYPES)
    .filter(([, v]) => v.group === "State & Local")
    .map(([k, v]) => ({ value: k, label: v.label, description: v.description })),
  "Commercial": Object.entries(SOLICITATION_TYPES)
    .filter(([, v]) => v.group === "Commercial")
    .map(([k, v]) => ({ value: k, label: v.label, description: v.description })),
};

function getSolicitation(type) {
  return SOLICITATION_TYPES[type] || SOLICITATION_TYPES.rfp_federal;
}

module.exports = { SOLICITATION_TYPES, SOLICITATION_GROUPS, getSolicitation };
