// Objective → measure coupling. An objective is a qualitative intent — a label,
// not measurable by itself; what is measurable is the MEASURE it carries:
// a metric from the native catalogue + a baseline + a target + a window
// (the PP's full contract). Everything here is DERIVED at render time:
// ctx.objective stays a string[] and the objective's identity is its label,
// exactly like objective-alerts-store. The one stored thing is the user's
// CORRECTIONS — `data.objectiveMeasures[label]` holds only the deviation:
//   { metricIds?: string[],                 // measured: chosen metrics
//     proxyId?: string,                     // parked: chosen proxy
//     window?: { type, date? },             // objective-level window
//     measureWindows?: { [metricId]: window },   // per-measure deviation
//     baselines?: { [metricId]: string },   // edited baseline VALUES
//     targets?:  { [metricId]: string } }   // edited targets (kills "Suggested")
// An absent key means the derived defaults below.
//
// The generator contract (PP "Objectives in Archie"): an intent that binds to a
// catalogue metric is measurable; a real intent that binds to nothing is PARKED
// — shown "coming soon" with an avowed social proxy — never dropped.
//
// Alignment note (platform prototype/sc-203354-report-studio-objective-widget):
// target + targetProposed and the "Suggested target" copy come from that
// prototype (proposeTarget = baseline × 1.15); its window model is
// ROLLING | FIXED — Archie adds the RECURRING cadences (weekly/monthly/
// quarterly) it lacks, and keeps 'deadline' as platform's FIXED. Identity
// diverges on purpose for now: platform keys objectives by id, Archie by
// label — flagged in the PP handoff, not resolved here.
//
// NOTE (reconciled in Insights): OBJECTIVE_METRICS in mocks.js measures "Lead
// generation" and "Sales" through their PROXY (CTA clicks / attributed revenue)
// on the Insights side, while this catalogue parks them. Insights marks those
// cards "via proxy" by resolving the label here — one story, two surfaces.

// The slice of the native catalogue (~25 metrics) these couplings use. The
// catalogue names the concept, not a per-network field. `lowerIsBetter`
// suppresses the progress gauge — a bar "toward target" lies when less is more.
const METRICS = {
  reach: { label: "Reach" },
  impressions: { label: "Impressions" },
  mentions: { label: "Brand mentions" },
  followersNet: { label: "Followers net growth", growth: true },
  engagementRate: { label: "Engagement rate" },
  comments: { label: "Comments received" },
  savesShares: { label: "Saves & shares" },
  videoViews: { label: "Video views" },
  videoCompletion: { label: "Completion rate" },
  sentiment: { label: "Sentiment score" },
  responseTime: { label: "Response time", lowerIsBetter: true },
  reviews: { label: "Reviews handled" },
  clicks: { label: "Link clicks" },
  paidReach: { label: "Paid reach" },
};

// The 7 catalogue families, for the measure picker — every metric above appears
// in exactly one family.
export const FAMILIES = [
  { id: "awareness", label: "Awareness", metricIds: ["reach", "impressions", "mentions"] },
  { id: "growth", label: "Audience growth", metricIds: ["followersNet"] },
  { id: "engagement", label: "Engagement", metricIds: ["engagementRate", "comments", "savesShares"] },
  { id: "video", label: "Video", metricIds: ["videoViews", "videoCompletion"] },
  { id: "care", label: "Reputation & care", metricIds: ["sentiment", "responseTime", "reviews"] },
  { id: "traffic", label: "Traffic", metricIds: ["clicks"] },
  { id: "paid", label: "Paid", metricIds: ["paidReach"] },
];

// The objective's window — how the target is read. Default: monthly, the
// 30-day-average world every baseline below is authored in. Defined on the
// objective, inherited by its measures, deviable per measure (a deviation is
// a deliberate act — the beginning of a split, per "split late").
export const WINDOWS = [
  { id: "weekly", label: "Every week" },
  { id: "monthly", label: "Every month" },
  { id: "quarterly", label: "Every quarter" },
  { id: "deadline", label: "Ends on a date" },
];

export const DEFAULT_WINDOW = { type: "monthly" };

export function windowLabel(window) {
  const w = window || DEFAULT_WINDOW;
  if (w.type === "deadline") return w.date ? `Ends on ${formatDay(w.date)}` : "Ends on a date";
  return WINDOWS.find((o) => o.id === w.type)?.label || "Every month";
}

function formatDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// What the baseline was read over, phrased for the measure's window.
function baselineNoteFor(metricId, window) {
  const growth = METRICS[metricId]?.growth;
  const w = (window || DEFAULT_WINDOW).type;
  if (w === "weekly") return growth ? "vs previous 7 days" : "/ 7-day avg";
  if (w === "quarterly") return growth ? "vs previous quarter" : "/ 90-day avg";
  if (w === "deadline") return growth ? "since the window opened" : "/ 30-day avg";
  return growth ? "vs previous 30 days" : "/ 30-day avg";
}

// Pre-formatted baseline VALUES — a prototype shows, it never measures. Figures
// rhyme with the measured cards in mocks.js (OBJECTIVE_METRICS / PLAYBOOK_REPORT)
// wherever both exist: reach 18,400, clicks 126, followers +1,240, rate 4.1%.
const DEFAULT_BASELINES = {
  reach: "18,400",
  impressions: "84,200",
  mentions: "48",
  followersNet: "+1,240",
  engagementRate: "4.1%",
  comments: "312",
  savesShares: "190",
  videoViews: "5,600",
  videoCompletion: "38%",
  sentiment: "76",
  responseTime: "1h 42m",
  reviews: "23",
  clicks: "126",
  paidReach: "9,800",
};

// Proposed targets, per metric — pre-formatted, rhyming with mocks.js `goal`
// where a card exists (reach 20,000, clicks 150, followers +1,500, rate 5.0%).
// The proposal rule is the platform prototype's: baseline × 1.15, rounded to a
// clean figure; the values are authored by hand because a prototype shows.
// A target stays PROPOSED ("Suggested") until the user edits it.
const DEFAULT_TARGETS = {
  reach: "20,000",
  impressions: "95,000",
  mentions: "60",
  followersNet: "+1,500",
  engagementRate: "5.0%",
  comments: "380",
  savesShares: "240",
  videoViews: "7,000",
  videoCompletion: "45%",
  sentiment: "82",
  responseTime: "1h 15m",
  reviews: "30",
  clicks: "150",
  paidReach: "12,000",
};

// Per-Playbook baseline values layered over the defaults, keyed by context id
// then metric — hand-derived from OBJECTIVE_METRICS_BY_CONTEXT so the same
// brand tells the same story on every surface (Acme's reach slides on purpose).
const BASELINES_BY_CONTEXT = {
  "ctx-acme": { reach: "14,800" },
  "ctx-founder-voice": { reach: "12,800" },
  "ctx-customer": { reach: "10,400", clicks: "107" },
  "ctx-dwelling": { reach: "17,600" },
};

// A concept metric split by network — plain values (the bounds line above them
// carries the window), keyed by the platform slugs social-profiles.js uses so
// the views can map straight to NETWORK_ICON_BY_PLATFORM / NETWORK_LABEL. Two
// networks rarely compute one concept the same way (Instagram reach and
// LinkedIn reach are not the same arithmetic), so the split is shown rather
// than pretending the sum is one clean number. Rows sum to the concept
// baseline where summing makes sense; rates and scores deliberately don't.
const NETWORK_BASELINES = {
  reach: { linkedin: "9,400", instagram: "6,200", x: "2,800" },
  impressions: { linkedin: "41,300", instagram: "28,600", x: "14,300" },
  mentions: { x: "21", instagram: "15", linkedin: "12" },
  followersNet: { instagram: "+640", linkedin: "+430", x: "+170" },
  engagementRate: { instagram: "5.2%", linkedin: "3.4%", x: "2.1%" },
  comments: { instagram: "168", linkedin: "96", x: "48" },
  savesShares: { instagram: "124", linkedin: "66" },
  videoViews: { instagram: "3,400", youtube: "1,700", x: "500" },
  videoCompletion: { youtube: "41%", instagram: "35%" },
  sentiment: { linkedin: "80", instagram: "79", x: "71" },
  responseTime: { instagram: "1h 18m", x: "2h 05m" },
  reviews: { facebook: "17", instagram: "6" },
  clicks: { linkedin: "64", instagram: "38", x: "24" },
  paidReach: { instagram: "5,600", facebook: "4,200" },
};

// Per-Playbook splits, consistent with INSIGHTS_USAGE's network shares (Acme
// publishes LinkedIn 71 / X 21 / Instagram 8) and with BASELINES_BY_CONTEXT
// (the Acme rows sum to its sliding 14,800 reach).
const NETWORK_BASELINES_BY_CONTEXT = {
  "ctx-acme": { reach: { linkedin: "10,500", x: "3,100", instagram: "1,200" } },
  "ctx-founder-voice": { reach: { linkedin: "9,900", x: "2,900" } },
  "ctx-customer": {
    reach: { linkedin: "6,000", instagram: "3,000", x: "1,400" },
    clicks: { linkedin: "55", instagram: "32", x: "20" },
  },
  "ctx-dwelling": { reach: { instagram: "10,900", facebook: "4,200", x: "2,500" } },
};

// Measurable couplings — category → metric(s), from "Metrics & couplings".
// Keys are the canonical labels the crawl and the seeds emit.
const COUPLINGS = {
  "Brand awareness": ["reach", "mentions"],
  "Build personal brand": ["followersNet", "engagementRate"],
  "Community building": ["engagementRate", "comments"],
  "Community engagement": ["engagementRate", "comments"],
  "Thought leadership": ["followersNet", "engagementRate"],
  "Editorial resonance": ["savesShares"],
  "Video performance": ["videoViews", "videoCompletion"],
  Reputation: ["sentiment"],
  "Brand reputation": ["sentiment"],
  "Customer care": ["responseTime", "reviews"],
  "Customer retention": ["responseTime", "sentiment"],
  Traffic: ["clicks"],
  "Drive traffic": ["clicks"],
  "Paid performance": ["paidReach"],
};

// Real intents the catalogue can't measure natively — parked, never dropped.
// `soon` says what unlocks the real measure; `proxy` is the avowed stand-in.
const PARKED = {
  "Lead generation": {
    soon: "On-site sign-ups need a Google Analytics connection.",
    proxy: "clicks",
  },
  Sales: {
    soon: "Attributed revenue needs a Google Analytics connection.",
    proxy: "clicks",
  },
  "Product adoption": {
    soon: "Product usage needs a product analytics connection.",
    proxy: "clicks",
  },
  "App downloads": {
    soon: "Store analytics are not connected yet.",
    proxy: "clicks",
  },
  "Net Promoter Score": {
    soon: "NPS needs a survey connection.",
    proxy: "sentiment",
  },
};

// A custom label typed in edit mode resolves by: exact COUPLINGS → exact PARKED
// (both case-insensitive) → first alias match → generic parked. An unknown
// intent is a real intent: it is kept, coming soon, with Engagement rate as
// the proxy. `\breach\b` keeps "Community Reached" out of Brand awareness
// ("Reached" fails the word boundary) so it falls through to Community
// building; "Grow reach" still matches.
const ALIASES = [
  [/awareness|\breach\b|impression|visib|notorie/i, "Brand awareness"],
  [/personal brand|thought leader|authority|follower/i, "Build personal brand"],
  [/communit|engag/i, "Community building"],
  [/video|watch|youtube|reel|tiktok/i, "Video performance"],
  [/net promoter|\bnps\b/i, "Net Promoter Score"],
  [/reputation|sentiment|brand health/i, "Reputation"],
  [/\bcare\b|support|response time|retention/i, "Customer care"],
  [/traffic|click|visit/i, "Traffic"],
  [/\bpaid\b|\bads?\b|campaign/i, "Paid performance"],
  [/\bsaves?\b|\bshares?\b|resonance/i, "Editorial resonance"],
  [/lead|sign.?up|conversion|demo|newsletter/i, "Lead generation"],
  [/\bsales?\b|revenue|sell|purchase/i, "Sales"],
  [/download|install|subscri|adoption/i, "Product adoption"],
];

const GENERIC_PARKED = {
  soon: "Not in the native metric catalog yet.",
  proxy: "engagementRate",
};

function findKeyInsensitive(map, label) {
  const needle = label.trim().toLowerCase();
  return Object.keys(map).find((k) => k.toLowerCase() === needle);
}

export function metricLabel(metricId) {
  return METRICS[metricId]?.label || metricId;
}

export function baselineFor(metricId, contextId) {
  const perContext = BASELINES_BY_CONTEXT[contextId] || {};
  return perContext[metricId] || DEFAULT_BASELINES[metricId];
}

function networksFor(metricId, contextId) {
  const perContext = (NETWORK_BASELINES_BY_CONTEXT[contextId] || {})[metricId];
  const split = perContext || NETWORK_BASELINES[metricId] || {};
  return Object.entries(split).map(([platform, baseline]) => ({ platform, baseline }));
}

// "14,800" → 14800, "4.1%" → 4.1, "+1,240" → 1240, "€8,900" → 8900,
// "1h 42m" → null. The gauge's one computation — an edited target has to move
// the bar, so the two bounds are parsed rather than authored as a percent.
function parseMetricValue(str) {
  if (typeof str !== "string") return null;
  const cleaned = str.replace(/[€$,+\s]/g, "").replace(/%$/, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

function progressPctFor(metricId, baselineValue, target) {
  if (METRICS[metricId]?.lowerIsBetter) return null;
  const current = parseMetricValue(baselineValue);
  const goal = parseMetricValue(target);
  if (current == null || goal == null || goal <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((current / goal) * 100)));
}

function measureFor(metricId, contextId, override, objectiveWindow) {
  const ov = override || {};
  const deviation = ov.measureWindows?.[metricId];
  const window = deviation
    ? { ...deviation, inherited: false }
    : { ...(objectiveWindow || DEFAULT_WINDOW), inherited: true };
  const baselineValue = ov.baselines?.[metricId] ?? baselineFor(metricId, contextId);
  const target = ov.targets?.[metricId] ?? DEFAULT_TARGETS[metricId];
  return {
    metricId,
    metricLabel: metricLabel(metricId),
    baselineValue,
    baselineNote: baselineNoteFor(metricId, window),
    baseline: `${baselineValue} ${baselineNoteFor(metricId, window)}`,
    target,
    targetProposed: ov.targets?.[metricId] == null,
    progressPct: progressPctFor(metricId, baselineValue, target),
    window,
    networks: networksFor(metricId, contextId),
  };
}

function resolveOne(label, contextId, override) {
  const canonical =
    findKeyInsensitive(COUPLINGS, label) ||
    findKeyInsensitive(PARKED, label) ||
    (ALIASES.find(([re]) => re.test(label)) || [])[1];
  const window = override?.window ? { ...override.window } : { ...DEFAULT_WINDOW };
  const base = { label, window, windowLabel: windowLabel(window) };
  if (canonical && COUPLINGS[canonical]) {
    // A user-chosen measure set replaces the coupling's defaults; unknown ids
    // (a rename moved the override across categories) are dropped silently.
    const chosen = (override?.metricIds || []).filter((id) => METRICS[id]);
    const ids = chosen.length ? chosen : COUPLINGS[canonical];
    return {
      ...base,
      status: "measured",
      measures: ids.map((id) => measureFor(id, contextId, override, window)),
    };
  }
  const parked = (canonical && PARKED[canonical]) || GENERIC_PARKED;
  const proxyId = override?.proxyId && METRICS[override.proxyId] ? override.proxyId : parked.proxy;
  return {
    ...base,
    status: "parked",
    soon: parked.soon,
    proxy: measureFor(proxyId, contextId, override, window),
  };
}

/** The one entry point: each objective label, resolved to a coupled object —
 *  measured (per measure: metric, baseline, target [proposed until edited],
 *  window [objective's unless deviated], progress %, per-network split) or
 *  parked (coming soon + avowed proxy, same measure shape). `contextId` may be
 *  undefined (onboarding draft): the account's social profiles already exist,
 *  so the default baselines stand in. `overrides` is the user's corrections
 *  map (`data.objectiveMeasures`), keyed by label. */
export function resolveObjectives(labels, contextId, overrides = {}) {
  const list = Array.isArray(labels) ? labels.filter(Boolean) : [];
  const map = overrides && typeof overrides === "object" ? overrides : {};
  return list.map((label) => resolveOne(label, contextId, map[label]));
}
