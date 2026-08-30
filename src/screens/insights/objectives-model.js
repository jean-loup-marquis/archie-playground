// Insights › Objectives — the derivation layer for the board, the list and
// the detail. One entry per (Playbook × objective label), resolved through
// the measure catalogue; the verdict is the counted roll-up (never weighted),
// grace entries carry no verdict and live in their own lane. Everything here
// derives from the store on every call — the board never keeps its own copy.

import { getContexts } from "../../contexts-store.js?v=97";
import { resolveObjectives, objectiveVerdict, measureState, isRateMetric } from "../../objective-measures.js?v=7";

// ── View preferences — persisted per user ────────────────────────────────────
// localStorage, like the sidebar's collapse/organize prefs (the app's one
// sanctioned localStorage use: UI preferences, never app state). Documented in
// CLAUDE.md's key list.
const PREFS_KEY = "archie-insights-view";

const DEFAULT_PREFS = {
  viewMode: "board", // board | list — board is the default view
  groupByPlaybook: false,
  sort: "playbook", // playbook | risk | progress
  playbookFilter: "", // "" = all playbooks
};

export function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(patch) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
  } catch {
    /* ignore */
  }
}

// ── Entries ──────────────────────────────────────────────────────────────────

export function boardEntries({ playbookFilter = "" } = {}) {
  const entries = [];
  getContexts().forEach((ctx) => {
    if (playbookFilter && ctx.id !== playbookFilter) return;
    const resolved = resolveObjectives(ctx.objective, ctx.id, ctx.objectiveMeasures);
    resolved.forEach((r) => {
      entries.push({
        key: `${ctx.id}::${r.label}`,
        ctxId: ctx.id,
        context: ctx,
        playbookName: ctx.name,
        label: r.label,
        resolved: r,
        verdict: objectiveVerdict(r),
        collecting: r.status === "collecting",
      });
    });
  });
  return entries;
}

// The three status columns + the grace lane. The column carries the status —
// a card never restates it.
export function columns(entries) {
  const out = { "at-risk": [], watch: [], strong: [], collecting: [] };
  entries.forEach((e) => {
    if (e.collecting) out.collecting.push(e);
    else if (e.verdict.tier) out[e.verdict.tier].push(e);
  });
  return out;
}

export const COLUMN_META = [
  { id: "at-risk", label: "At risk", tone: "red" },
  { id: "watch", label: "Watch", tone: "yellow" },
  { id: "strong", label: "On track", tone: "green" },
];

const TIER_RANK = { "at-risk": 0, watch: 1, strong: 2 };

// The measure the objective is worth reading FOR — worst state first, lowest
// progress inside a state. The list summary, the card's chips and the
// detail's expanded section all start here.
export function weakestMeasure(entry) {
  const r = entry.resolved;
  const measures = r.status === "measured" || r.status === "collecting" ? r.measures : [r.proxy];
  const rank = { off: 0, soft: 1, on: 2 };
  return [...measures].sort(
    (a, b) => rank[measureState(a)] - rank[measureState(b)] || (a.progressPct ?? 101) - (b.progressPct ?? 101),
  )[0];
}

export function sortEntries(entries, sort) {
  const list = [...entries];
  if (sort === "risk") {
    return list.sort((a, b) => {
      const ra = a.collecting ? 3 : (TIER_RANK[a.verdict.tier] ?? 3);
      const rb = b.collecting ? 3 : (TIER_RANK[b.verdict.tier] ?? 3);
      if (ra !== rb) return ra - rb;
      return (weakestMeasure(a)?.progressPct ?? 101) - (weakestMeasure(b)?.progressPct ?? 101);
    });
  }
  if (sort === "progress") {
    return list.sort((a, b) => (weakestMeasure(a)?.progressPct ?? 101) - (weakestMeasure(b)?.progressPct ?? 101));
  }
  return list.sort((a, b) => a.playbookName.localeCompare(b.playbookName) || a.label.localeCompare(b.label));
}

export const SORTS = [
  { id: "playbook", label: "Sort: by playbook" },
  { id: "risk", label: "Sort: most at risk" },
  { id: "progress", label: "Sort: by progress" },
];

// ── Copy derivations ─────────────────────────────────────────────────────────

const PACE_WORDS = { ahead: "ahead", "on-pace": "on pace", behind: "behind", holding: "holding", below: "below" };
const TREND_WORDS = { up: "up", flat: "flat", down: "down" };

// The list rail's one-line summary: "Noba Fashion · link clicks 42% · behind, down".
export function listSummary(entry) {
  if (entry.collecting) {
    const g = entry.resolved.grace;
    return `${entry.playbookName} · day ${g.day} of ${g.of}, no verdict`;
  }
  const w = weakestMeasure(entry);
  if (!w) return entry.playbookName;
  if (isRateMetric(w.metricId)) {
    const climb = w.trend?.dir === "up" ? ", climbing" : w.trend?.dir === "down" ? ", slipping" : "";
    return `${entry.playbookName} · ${w.baselineValue} vs ${w.target}${climb}`;
  }
  return `${entry.playbookName} · ${w.metricLabel.toLowerCase()} ${w.progressPct ?? "—"}% · ${PACE_WORDS[w.pace?.id] || ""}, ${TREND_WORDS[w.trend?.dir] || ""}`;
}

// The detail's narrative reading — authored where the design authored it,
// derived templates everywhere else.
const OBJECTIVE_READINGS = {
  "ctx-noba::Sales": {
    headline: "The clicks aren't coming — because almost nothing published carries a link.",
    body: "Link clicks stand in for sales until Google Analytics is connected. They're at 42% of target, behind pace and slowing. Of 41 posts, 4 carry a product and a price — they drive every click counted here.",
  },
};

export function readingFor(entry) {
  const authored = OBJECTIVE_READINGS[entry.key];
  if (authored) return authored;
  const w = weakestMeasure(entry);
  const v = entry.verdict;
  if (entry.collecting) {
    const g = entry.resolved.grace;
    return {
      headline: `Collecting data — day ${g.day} of ${g.of}.`,
      body: "The measures are wired and reading; the verdict waits until there is enough data to defend one.",
    };
  }
  if (!w) return { headline: entry.label, body: "" };
  const proxyNote = entry.resolved.status === "parked" ? `${w.metricLabel} stands in as the proxy meanwhile. ` : "";
  if (v.tier === "at-risk") {
    return {
      headline: `${w.metricLabel} is at ${w.progressPct}% of target — ${PACE_WORDS[w.pace?.id]} and trending ${TREND_WORDS[w.trend?.dir]}.`,
      body: `${proxyNote}${v.phrase}. The gap is widening on the window; the posts below carry what movement there is.`,
    };
  }
  if (v.tier === "watch") {
    return {
      headline: `Holding, but ${w.metricLabel.toLowerCase()} argues — ${PACE_WORDS[w.pace?.id]}, trending ${TREND_WORDS[w.trend?.dir]}.`,
      body: `${proxyNote}${v.phrase}. Nothing is lost yet; the weak measure below is where the verdict is decided.`,
    };
  }
  return {
    headline: `On pace across ${v.total} measure${v.total > 1 ? "s" : ""} — keep the cadence.`,
    body: `${proxyNote}${v.phrase}. The reading below shows what carries it.`,
  };
}

// The expanded measure's two captions — each names the verdict it feeds.
export function paceCaption(measure) {
  if (measure.progressPct == null) return "";
  if (isRateMetric(measure.metricId)) {
    return `the bar is ${measure.target} — pace verdict comes from here`;
  }
  const per = perWeekNeed(measure);
  return per
    ? `needs ${per.need}/week to close · running at ${per.running} — pace verdict comes from here`
    : "pace verdict comes from here";
}

export function trendCaption(measure) {
  const pct = measure.trend?.pct ?? 0;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct)}% on the window — trend verdict comes from here`;
}

function parseNum(str) {
  if (typeof str !== "string") return null;
  const cleaned = str.replace(/[€$,+\s]/g, "").replace(/%$/, "");
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

function perWeekNeed(measure) {
  const current = parseNum(measure.baselineValue);
  const target = parseNum(measure.target);
  if (current == null || target == null || target <= current) return null;
  const need = Math.max(1, Math.ceil((target - current) / 4));
  const running = Math.max(0, Math.round((need * (measure.progressPct ?? 0)) / 100));
  const unit = measure.metricLabel.toLowerCase().includes("click") ? " clicks" : "";
  return { need: `${need}${unit}`, running };
}

// A deterministic sparkline: linear drift toward the trend, fixed jitter — no
// randomness, so two paints of the same measure draw the same line.
const JITTER = [0.4, -0.25, 0.15, -0.4, 0.3, -0.1, 0.2, -0.3, 0.1];

export function sparklinePoints(trendPct, { n = 9, w = 200, h = 44, pad = 3 } = {}) {
  const drift = Math.max(-0.8, Math.min(0.8, trendPct / 25));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const value = 0.5 + drift * (t - 0.5) + JITTER[i % JITTER.length] * 0.16;
    const x = pad + t * (w - pad * 2);
    const y = pad + (1 - Math.max(0.05, Math.min(0.95, value))) * (h - pad * 2);
    pts.push(`${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`);
  }
  return pts.join(" ");
}
