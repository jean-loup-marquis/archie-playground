// ---- Objective scoring (the single verdict source) -------------------------
//
// Turns the measured numbers in `mocks.js` into a verdict, so the Playbook
// detail card and the Analytics hub read the same objective the same way. The
// verdict is derived, never stored — that's what keeps the two surfaces honest.
//
// Progress-to-goal sets the tier; a flat or declining 30-day trend drops it one
// notch. The benchmark stays informational and never gates the tier: being ahead
// of the industry while missing your own goal is still missing your goal.
//
// Two open assumptions, deliberately visible rather than buried:
//   - objectives are weighted equally in a Playbook's aggregate (v1);
//   - the 15-point trend penalty is a round starting value, not calibrated.

const STRONG_FLOOR = 80;
const WATCH_FLOOR = 60;
const TREND_PENALTY = 15;

function tierFor(score) {
  if (score >= STRONG_FLOOR) return "strong";
  return score >= WATCH_FLOOR ? "watch" : "at-risk";
}

export function objectiveTier(progress, variationPercent) {
  const base = tierFor(progress);
  if (variationPercent > 0) return base;
  return base === "strong" ? "watch" : "at-risk";
}

export function effectiveScore(progress, variationPercent) {
  const penalty = variationPercent <= 0 ? TREND_PENALTY : 0;
  return Math.max(0, Math.min(progress, 100) - penalty);
}

// Equal-weight average of the objectives' effective scores, so the ring gauge
// and the chips beside it can never contradict each other.
export function playbookScore(objectives) {
  if (!objectives?.length) return { score: 0, tier: "at-risk" };
  const total = objectives.reduce((sum, o) => sum + effectiveScore(o.progress, o.variationPercent), 0);
  const avg = total / objectives.length;
  return { score: Math.round(avg * 10) / 10, tier: tierFor(avg) };
}

export const TIER_LABELS = {
  strong: "Strong",
  watch: "Watch",
  "at-risk": "At risk",
};

// Shared so the Playbook card and the hub can't drift into different colours for
// the same verdict. Values are `.ap-status` modifiers.
export const TIER_STATUS_CLASS = {
  strong: "green",
  watch: "orange",
  "at-risk": "red",
};

// Ranking for the "needs attention first" default sort.
export const TIER_ORDER = { "at-risk": 0, watch: 1, strong: 2 };
