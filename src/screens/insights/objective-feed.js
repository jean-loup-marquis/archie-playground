// The Insights card's two outer bands (handoff 1a–1e): "From your feed" (the
// topics happening outside, tied to the objective) and "View history" (the
// objective's timeline). Both are AUTHORED for the demo's hero objectives in
// mocks.js and DERIVED for everyone else, so every objective renders a full
// card — the same authored-else-derived shape objectives-model uses for the
// narrative reading and objective-flow uses for the Next move.

import { objectiveFeedTopics, objectiveHistory } from "../../mocks.js?v=118";
import { isRateMetric } from "../../objective-measures.js?v=7";
import { weakestMeasure } from "./objectives-model.js?v=2";

// Badge tone → the DS .ap-badge colour it reuses. `explains` is the cause of a
// slip (red), `drives` the fuel of a run (green), `angle` a neutral opening.
export const FEED_BADGE_TONE = {
  explains: "red",
  drives: "green",
  angle: "grey",
};

// Timeline dot tone → class. Verdict events carry the tier colour; changes are
// grey; moves are Archie orange.
export const HISTORY_DOT_CLASS = {
  red: "objd__tldot--red",
  yellow: "objd__tldot--yellow",
  green: "objd__tldot--green",
  grey: "objd__tldot--grey",
  orange: "objd__tldot--orange",
};

const HISTORY_KIND_LABEL = { verdict: "Verdicts", change: "Changes", move: "Moves" };

export function historyFilters() {
  return [
    { id: "all", label: "All" },
    { id: "verdict", label: HISTORY_KIND_LABEL.verdict },
    { id: "change", label: HISTORY_KIND_LABEL.change },
    { id: "move", label: HISTORY_KIND_LABEL.move },
  ];
}

// ── From your feed ───────────────────────────────────────────────────────────

function weakLabel(entry) {
  return weakestMeasure(entry)?.metricLabel || "reach";
}

export function feedTopicsFor(entry) {
  const authored = objectiveFeedTopics[entry.key];
  if (authored) return authored;
  const metric = weakLabel(entry).toLowerCase();
  const pillar = entry.playbookName;
  if (entry.collecting) {
    return [
      {
        badge: { text: `Angle · ${metric}`, tone: "angle" },
        title: `What's landing for accounts like ${pillar}`,
        blurb: `The outside is already talking — a live opening to seed ${metric} before the first verdict.`,
        momentum: "rising · this week",
      },
    ];
  }
  const strong = entry.verdict?.tier === "strong";
  const lead = strong
    ? {
        badge: { text: `Drives ${metric} ↗`, tone: "drives" },
        title: `The angle carrying ${metric}`,
        blurb: `Whatever you changed is working — the conversation is still climbing.`,
        momentum: "peaking · this week",
      }
    : {
        badge: { text: `Explains ${metric} ↘`, tone: "explains" },
        title: `A shift is pulling on ${metric}`,
        blurb: `Your movement tracks a change happening outside — worth countering this week.`,
        momentum: "trending · this week",
      };
  return [
    lead,
    {
      badge: { text: `Angle · ${metric}`, tone: "angle" },
      title: `A live debate in ${pillar}'s space`,
      blurb: "A conversation your best posts already ride — still climbing.",
      momentum: "rising · this week",
    },
  ];
}

// The feed's one-line caption, tuned by state — the design's second half of the
// "FROM YOUR FEED" eyebrow.
export function feedCaption(entry) {
  if (entry.collecting) return "no verdict yet — but the outside is already talking";
  if (entry.verdict?.tier === "strong") return "what's fueling the run — keep riding it";
  return "what's happening outside — fuel for the plan";
}

// ── History ──────────────────────────────────────────────────────────────────

export function historyFor(entry) {
  const authored = objectiveHistory[entry.key];
  if (authored) return authored;
  const events = [];
  if (entry.collecting) {
    const g = entry.resolved.grace;
    events.push({
      date: "Now",
      kind: "change",
      dot: "grey",
      title: `Collecting — day ${g.day} of ${g.of}`,
      body: "The measures are wired and reading; the first verdict waits for a full window.",
    });
  } else if (entry.verdict?.tier) {
    const dot = entry.verdict.tier === "strong" ? "green" : entry.verdict.tier === "watch" ? "yellow" : "red";
    const w = weakestMeasure(entry);
    const figure = w
      ? isRateMetric(w.metricId)
        ? `${w.baselineValue} vs ${w.target}`
        : `${w.progressPct ?? "—"}% of target`
      : "";
    events.push({
      date: "Now",
      kind: "verdict",
      dot,
      title: `Current verdict — ${entry.verdict.label}`,
      body: `${entry.verdict.phrase}${figure ? ` · weakest measure at ${figure}` : ""}.`,
    });
  }
  events.push({
    date: "At creation",
    kind: "change",
    dot: "grey",
    title: `Objective created from the ${entry.playbookName} playbook`,
    body: "Proposed by Archie · from your website.",
  });
  return events;
}
