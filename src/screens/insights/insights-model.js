import { getContexts } from "../../contexts-store.js?v=97";
import {
  objectiveCardsFor,
  insightsPanelFor,
  insightsUsageFor,
  insightsPortfolio,
  draftingHoursSaved,
  wordsDrafted,
} from "../../mocks.js?v=115";
import { objectiveTier, playbookScore, TIER_LABELS, TIER_ORDER } from "../../objective-scoring.js?v=25";

// Insights' derivation layer — everything the three tabs read, computed once here.
//
// The rule this module exists to enforce: a figure appears in mocks.js OR it is
// derived, never both. The design doc's rail order (47 · 59 · 72 · 74 · 79 · 84 ·
// 88) is not authored anywhere — it falls out of playbookScore over the objectives
// the Playbooks already declare, which is how the doc arrived at it. Same for
// "9 / 13 objectives on pace" and for every "time saved" figure on the page.
//
// Tabs get plain objects out of here and render them. No tab reads mocks.js for a
// number two tabs both show.

// ── The period ──────────────────────────────────────────────────────────────
// 7 / 30 / 60 days, 30 default, 60 the hard cap. The cap is the product's, not a
// UI choice: Archie keeps 60 days of its own posts and nothing before that, which
// is the one place this page points at Agorapulse.
//
// The authored figures in mocks.js are the 30-day window. Choosing another window
// SCALES the volumes by the factor below and restates the period on every figure.
// The factors are a documented mock derivation, not data — publishing is not
// uniform, so a week is not a third of a month and two months is not twice one.
//
// What does NOT scale: goal progress, verdicts and trends. A goal target is
// monthly, so the goals block always reads on 30 days and says so — which is the
// doc's own answer in E2, where every block states the window it can defend.
export const PERIODS = [
  { id: "7", days: 7, label: "7 days", factor: 0.24 },
  { id: "30", days: 30, label: "30 days", factor: 1 },
  { id: "60", days: 60, label: "60 days", factor: 1.9 },
];

export const DEFAULT_PERIOD = "30";

export function periodFor(id) {
  return PERIODS.find((p) => p.id === id) || PERIODS.find((p) => p.id === DEFAULT_PERIOD);
}

/** "last 30 days" — the string that follows every figure on the page. */
export function periodLabel(id) {
  return `last ${periodFor(id).days} days`;
}

/** A volume figure restated for the chosen window. */
export function scaleVolume(value, id) {
  const factor = periodFor(id).factor;
  if (factor === 1) return value;
  return Math.round(value * factor);
}

/** True at the cap, where the page has to say the window ends. */
export function isAtCap(id) {
  return periodFor(id).days === 60;
}

// ── The Performance rail ────────────────────────────────────────────────────
// One row per Playbook: name, score, verdict, and the one line about why it is
// where it is. Ranked worst first — "where to look first", which is attention and
// not blame, so the row carries the verdict as a WORD and never a badge.
export function performanceRows() {
  return getContexts()
    .map((context) => {
      const objectives = objectiveCardsFor(context);
      const { score, tier } = playbookScore(objectives);
      const panel = insightsPanelFor(context);
      return {
        id: context.id,
        context,
        name: context.name,
        objectives,
        score: Math.round(score),
        tier,
        verdict: TIER_LABELS[tier],
        reason: panel?.reason || "",
      };
    })
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.score - b.score);
}

// ── The Usage rail ──────────────────────────────────────────────────────────
// Most active first. No health score here: volume and keep rate are the usage
// vocabulary, and a verdict on how much Archie wrote would be a verdict on the
// reader's month.
export function usageRows(period = DEFAULT_PERIOD) {
  // Joined against the STORE, not against the seed array. It used to read
  // mocks.contexts directly, which meant deleting a Playbook left it on the Usage
  // rail and left its posts in the portfolio strip's sum — the rail and the strip
  // disagreeing with the Playbooks library about which brands exist.
  return getContexts()
    .map((context) => ({ context, usage: insightsUsageFor(context) }))
    .filter((r) => r.usage)
    .map(({ context, usage }) => ({
      id: context.id,
      context,
      name: context.name,
      usage,
      posts: scaleVolume(usage.posts, period),
      keptRate: usage.keptRate,
      note: usage.railNote || "",
    }))
    .sort((a, b) => b.posts - a.posts);
}

// ── Which Playbook the panel opens on ───────────────────────────────────────
// "Where to look first" has two answers and the page owes both: the most pressing
// Playbook when something needs deciding, the best trend when nothing does. The
// second case is E5 — a good month should read as one, rather than as an empty
// panel under seven green rows.
export function defaultSelection(rows) {
  if (rows.length === 0) return null;
  const pressing = rows.find((r) => r.tier !== "strong");
  if (pressing) return pressing.id;
  return rows[rows.length - 1].id;
}

/** True when nothing needs deciding — the panel opens in proof mode. */
export function allClear(rows) {
  return rows.length > 0 && rows.every((r) => r.tier === "strong");
}

export function resolveSelection(rows, wanted) {
  if (wanted && rows.some((r) => r.id === wanted)) return wanted;
  return defaultSelection(rows);
}

// ── The portfolio strips ────────────────────────────────────────────────────
// Everything summable is summed from the rows below it. The strip is the only
// place on the page that speaks for all seven Playbooks at once, so a figure it
// states and a row it sits above must be the same number.
export function performanceStrip(period = DEFAULT_PERIOD) {
  const authored = insightsPortfolio("performance");
  const rows = performanceRows();
  const tiers = rows.flatMap((r) => r.objectives.map((o) => objectiveTier(o.progress, o.variationPercent)));
  const reach = portfolioReach(rows);
  return {
    playbooks: rows.length,
    reach: scaleVolume(reach.total, period),
    reachVariation: reach.variation,
    reachPlaybooks: reach.playbooks,
    posts: usageRows(period).reduce((sum, r) => sum + r.posts, 0),
    engagementRate: authored.engagementRate,
    onPace: tiers.filter((t) => t !== "at-risk").length,
    objectives: tiers.length,
    note: authored.note,
  };
}

// Portfolio reach, summed from the reach objectives the Playbooks declare — never
// authored. Every summand is one rail click away, which is the only version of this
// headline figure the Value tab can honestly call checkable.
//
// A Playbook with no reach goal contributes nothing rather than an estimate, so the
// strip reports how many Playbooks the figure actually covers. The variation is
// weighted by each Playbook's own reach: an average that ignored size would let the
// smallest brand's month set the portfolio's headline trend.
function portfolioReach(rows) {
  const reachObjectives = rows.flatMap((r) =>
    r.objectives
      .filter((o) => o.metric === "reach")
      .map((o) => ({ playbook: r.id, value: parseFigure(o.value) || 0, variation: o.variationPercent })),
  );
  const total = reachObjectives.reduce((sum, o) => sum + o.value, 0);
  const weighted = reachObjectives.reduce((sum, o) => sum + o.value * o.variation, 0);
  return {
    total,
    variation: total === 0 ? 0 : Math.round((weighted / total) * 10) / 10,
    playbooks: new Set(reachObjectives.map((o) => o.playbook)).size,
  };
}

export function usageStrip(period = DEFAULT_PERIOD) {
  const authored = insightsPortfolio("usage");
  const rows = usageRows(period);
  const drafts = rows.reduce((sum, r) => sum + scaleVolume(r.usage.drafts, period), 0);
  return {
    playbooks: rows.length,
    // Derived from the drafts below it, not authored beside them: a word count that
    // held still while the draft count fell was the strip contradicting its own rail.
    words: wordsDrafted(drafts),
    drafts,
    posts: rows.reduce((sum, r) => sum + r.posts, 0),
    keptRate: authored.keptRate,
    note: authored.note,
  };
}

// ── The Value ledger ────────────────────────────────────────────────────────
// The renewal question, portfolio-wide, and the only tab that claims anything. So
// it claims ONLY what improved: the goals it lists are the ones whose own trend is
// positive, best first, and the ones still behind are counted and sent to
// Performance rather than explained away here.
export function valueLedger(period = DEFAULT_PERIOD) {
  const authored = insightsPortfolio("value");
  const perf = performanceStrip(period);
  const usage = usageStrip(period);

  const objectives = performanceRows().flatMap((row) =>
    row.objectives.map((o) => ({
      objective: o.objective,
      playbook: row.name,
      playbookScore: row.score,
      value: o.value,
      variation: o.variationPercent,
      metric: o.metric,
      tier: objectiveTier(o.progress, o.variationPercent),
    })),
  );

  return {
    reach: perf.reach,
    reachVariation: perf.reachVariation,
    reachPlaybooks: perf.reachPlaybooks,
    hoursSaved: draftingHoursSaved(perf.posts),
    posts: perf.posts,
    signalsActed: authored.signalsActed,
    signalsSurfaced: authored.signalsSurfaced,
    keptRate: usage.keptRate,
    drafts: usage.drafts,
    improved: improvedGoals(objectives),
    behind: objectives.filter((o) => o.tier === "at-risk").length,
  };
}

// A goal that improved, and by how much — with the figure it improved FROM derived
// from its own trend rather than authored beside it. That is what stops the ledger
// claiming +21% on an objective the Performance tab measures at +8%.
//
// Deduplicated by objective name: several Playbooks share a base metric in the
// seed, and two rows reading "Brand awareness 18,400 +12%" for different brands
// reads as a bug rather than as a portfolio.
//
// The tie-break between two identical wins is the PLAYBOOK's own score, and it is
// not cosmetic: without it the row went to whichever brand the seed happened to
// list first, which credited the portfolio's best gain to a Playbook the tab
// beside it calls At risk. Among equal wins, name the brand where the rest of the
// picture supports the claim.
// One row per Playbook too, for the same reason at a different scale: three rows
// where two are the same brand is one brand's good month, not a portfolio's.
function improvedGoals(objectives) {
  const seenObjective = new Set();
  const seenPlaybook = new Set();
  return objectives
    .filter((o) => o.variation > 0)
    .sort((a, b) => b.variation - a.variation || b.playbookScore - a.playbookScore)
    .filter((o) => {
      if (seenObjective.has(o.objective) || seenPlaybook.has(o.playbook)) return false;
      seenObjective.add(o.objective);
      seenPlaybook.add(o.playbook);
      return true;
    })
    .slice(0, 3)
    .map((o) => {
      const after = parseFigure(o.value);
      return { ...o, before: roundDerived(backOut(after, o.variation)), after };
    });
}

function backOut(after, variation) {
  return after === null ? null : after / (1 + variation / 100);
}

// A figure derived from a percentage is not precise to the unit, so it is not
// printed as though it were: "16,400", never "16,429". Rounded to the nearest 100
// above a thousand, to the unit below it — a lead count of 117 is a count.
function roundDerived(n) {
  if (n === null) return null;
  return n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n);
}

// "18,400" / "€8,900" / "4.1%" → a number, or null when the value is not one.
function parseFigure(value) {
  const digits = String(value).replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** The posts that carried the month — one per Playbook, the best three. */
export function winningPosts() {
  return getContexts()
    .map((context) => ({ context, worked: insightsPanelFor(context)?.whatWorked }))
    .filter((r) => r.worked)
    .sort((a, b) => viewsOf(b.worked) - viewsOf(a.worked))
    .slice(0, 3);
}

function viewsOf(worked) {
  const n = parseFloat(String(worked.views).replace(/[^0-9.]/g, "")) || 0;
  return /K/i.test(worked.views) ? n * 1000 : n;
}

/** The Usage panel's numbers for one Playbook, restated for the window. */
export function usagePanelFor(context, period = DEFAULT_PERIOD) {
  const usage = insightsUsageFor(context);
  if (!usage) return null;
  const posts = scaleVolume(usage.posts, period);
  const drafts = scaleVolume(usage.drafts, period);
  return {
    ...usage,
    posts,
    drafts,
    sources: scaleVolume(usage.sources, period),
    perDay: Math.round(drafts / periodFor(period).days),
    publishedShare: drafts === 0 ? 0 : Math.round((posts / drafts) * 100),
    hoursSaved: draftingHoursSaved(posts),
  };
}
