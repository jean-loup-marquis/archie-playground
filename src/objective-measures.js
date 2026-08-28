// Objective → measure coupling. An objective is a qualitative intent — a label,
// not measurable by itself; what is measurable is the MEASURE it carries: a
// metric from the native catalogue plus a baseline (default: trailing 30-day
// average; growth metrics: delta vs the previous period). Everything here is
// DERIVED at render time, never stored: ctx.objective stays a string[] and the
// objective's identity is its label, exactly like objective-alerts-store.
//
// The generator contract (PP "Objectives in Archie"): an intent that binds to a
// catalogue metric is measurable; a real intent that binds to nothing is PARKED
// — shown "coming soon" with an avowed social proxy — never dropped.
//
// NOTE (slice 2): OBJECTIVE_METRICS in mocks.js measures "Lead generation" and
// "Sales" through their PROXY (CTA clicks / attributed revenue) on the Insights
// side, while this catalogue parks them. Narratively consistent — Insights reads
// the avowed proxy — but the Insights card doesn't SAY "proxy" yet. That
// reconciliation is the next slice; this module is the recap's truth.

// The slice of the native catalogue (~25 metrics) these couplings use. The
// catalogue names the concept, not a per-network field.
const METRICS = {
  reach: { label: "Reach" },
  impressions: { label: "Impressions" },
  mentions: { label: "Brand mentions" },
  followersNet: { label: "Followers net growth" },
  engagementRate: { label: "Engagement rate" },
  comments: { label: "Comments received" },
  savesShares: { label: "Saves & shares" },
  videoViews: { label: "Video views" },
  videoCompletion: { label: "Completion rate" },
  sentiment: { label: "Sentiment score" },
  responseTime: { label: "Response time" },
  reviews: { label: "Reviews handled" },
  clicks: { label: "Link clicks" },
  paidReach: { label: "Paid reach" },
};

// Pre-formatted baselines — a prototype shows, it never computes. Figures rhyme
// with the measured cards in mocks.js (OBJECTIVE_METRICS / PLAYBOOK_REPORT)
// wherever both exist: reach 18,400, clicks 126, followers +1,240, rate 4.1%.
const DEFAULT_BASELINES = {
  reach: "18,400 / 30-day avg",
  impressions: "84,200 / 30-day avg",
  mentions: "48 / 30-day avg",
  followersNet: "+1,240 vs previous 30 days",
  engagementRate: "4.1% / 30-day avg",
  comments: "312 / 30-day avg",
  savesShares: "190 / 30-day avg",
  videoViews: "5,600 / 30-day avg",
  videoCompletion: "38% / 30-day avg",
  sentiment: "76 / 30-day avg",
  responseTime: "1h 42m / 30-day avg",
  reviews: "23 / 30-day avg",
  clicks: "126 / 30-day avg",
  paidReach: "9,800 / 30-day avg",
};

// Per-Playbook baselines layered over the defaults, keyed by context id then
// metric — hand-derived from OBJECTIVE_METRICS_BY_CONTEXT so the same brand
// tells the same story on every surface (Acme's reach slides on purpose).
const BASELINES_BY_CONTEXT = {
  "ctx-acme": { reach: "14,800 / 30-day avg" },
  "ctx-founder-voice": { reach: "12,800 / 30-day avg" },
  "ctx-customer": { reach: "10,400 / 30-day avg", clicks: "107 / 30-day avg" },
  "ctx-dwelling": { reach: "17,600 / 30-day avg" },
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
};

// A custom label typed in edit mode resolves by: exact COUPLINGS → exact PARKED
// (both case-insensitive) → first alias match → generic parked. An unknown
// intent is a real intent: it is kept, coming soon, with Engagement rate as
// the proxy.
const ALIASES = [
  [/awareness|reach|impression|visib|notorie/i, "Brand awareness"],
  [/personal brand|thought leader|authority|follower/i, "Build personal brand"],
  [/communit|engag/i, "Community building"],
  [/video|watch|youtube|reel|tiktok/i, "Video performance"],
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

function measureFor(metricId, contextId) {
  const perContext = BASELINES_BY_CONTEXT[contextId] || {};
  return {
    metricLabel: METRICS[metricId].label,
    baseline: perContext[metricId] || DEFAULT_BASELINES[metricId],
  };
}

function resolveOne(label, contextId) {
  const canonical =
    findKeyInsensitive(COUPLINGS, label) ||
    findKeyInsensitive(PARKED, label) ||
    (ALIASES.find(([re]) => re.test(label)) || [])[1];
  if (canonical && COUPLINGS[canonical]) {
    return {
      label,
      status: "measured",
      measures: COUPLINGS[canonical].map((id) => measureFor(id, contextId)),
    };
  }
  const parked = (canonical && PARKED[canonical]) || GENERIC_PARKED;
  return {
    label,
    status: "parked",
    soon: parked.soon,
    proxy: measureFor(parked.proxy, contextId),
  };
}

/** The recap's one entry point: each objective label, resolved to a coupled
 *  object — measured (metric + baseline per measure) or parked (coming soon +
 *  avowed proxy). `contextId` may be undefined (onboarding draft): the account's
 *  social profiles already exist, so the default baselines stand in. */
export function resolveObjectives(labels, contextId) {
  const list = Array.isArray(labels) ? labels.filter(Boolean) : [];
  return list.map((label) => resolveOne(label, contextId));
}
