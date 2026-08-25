import { escapeText, escapeAttr } from "../../utils.js?v=45";
import { renderEmptyState } from "../../components/empty-state.js?v=26";
import { TIER_LABELS } from "../../objective-scoring.js?v=25";
import { formatGroupedNumber } from "../../report-widgets/number-formatting.js?v=25";
import { periodLabel, isAtCap } from "./insights-model.js?v=3";

// The pieces both master-detail tabs draw, in one place so Performance and Usage
// cannot drift into two versions of the same rail.
//
// Nothing here decides anything: every function takes what it renders. The rules
// it does enforce are the doc's two that hold everywhere — a verdict is a word in
// coloured text and never a pill, and no figure is printed without its period.

// ── The verdict, as a word ──────────────────────────────────────────────────
// `.ap-status` is the app's VERDICT pill and it is deliberately not used here. The
// doc's reason is that a rail of seven pills reads as seven alarms; the practical
// one is that a pill next to a score next to a reason is three competing shapes on
// one line. Coloured text, and the colour is the same token the pill would use.
export function verdictWord(tier) {
  return `<span class="insights-verdict insights-verdict--${escapeAttr(tier)}">${TIER_LABELS[tier]}</span>`;
}

// Annular gauge, not a filled disc: the hole is what stops it reading as a pie
// chart of parts when it is one score out of 100.
export function renderRing(score, tier) {
  return `
    <div
      class="analytics-card__ring analytics-card__ring--${escapeAttr(tier)}"
      style="--ring-progress: ${Math.round(score)}"
      role="img"
      aria-label="Health score ${Math.round(score)} out of 100"
    >
      <span class="analytics-card__ring-value">${Math.round(score)}</span>
    </div>`;
}

// ── The portfolio strip ─────────────────────────────────────────────────────
// The only line on the page that speaks for every Playbook at once. It states the
// window once, for the figures on its own row — each block below states its own.
export function renderStrip({ playbooks, period, figures, note }) {
  const cells = figures.map((f) => `<span class="insights-strip__figure">${f.html}</span>`).join("");

  return `
    <div class="insights-strip">
      <span class="insights-strip__scope">
        Across ${playbooks} ${playbooks === 1 ? "Playbook" : "Playbooks"}, ${escapeText(periodLabel(period))}:
      </span>
      ${cells}
      <span class="insights-strip__note">${escapeText(note)}</span>
    </div>`;
}

/** A figure in the strip, in the mono face every number on this page uses. */
export function stripFigure(text, { variation = null } = {}) {
  const trend = variation === null ? "" : ` ${renderTrend(variation)}`;
  return `<span class="insights-figure">${escapeText(text)}</span>${trend}`;
}

// ── Trends ──────────────────────────────────────────────────────────────────
// U+2212 for the minus, matching the benchmark strings in mocks.js — a hyphen
// beside a real minus in the same panel reads as a typo.
export function renderTrend(variation, { suffix = "" } = {}) {
  const rounded = Math.round(variation * 10) / 10;
  if (rounded === 0) {
    return `<span class="insights-trend"><i class="ap-icon-data-stagnate" aria-hidden="true"></i>flat${escapeText(suffix)}</span>`;
  }
  const up = rounded > 0;
  const icon = up ? "ap-icon-data-increase" : "ap-icon-data-decrease";
  const sign = up ? "+" : "−";
  return `
    <span class="insights-trend ${up ? "is-up" : "is-down"}">
      <i class="${icon}" aria-hidden="true"></i>${sign}${escapeText(String(Math.abs(rounded)))}%${escapeText(suffix)}
    </span>`;
}

// ── The rail ────────────────────────────────────────────────────────────────
// Cards, in the Topic Feed's own card family — same white-on-grey, same 1px
// grey-10 border, same 14px radius, and the same anatomy read top to bottom:
// a meta line, the name, then the one thing to know about it.
//
// It was `.ap-list-panel` before. That component is the DS's SETTINGS sidebar —
// flush rows divided by hairlines — and beside a reading panel it made Insights
// look like it came from a different app than the Topic Feed, which is the same
// list-plus-panel shape one section over. The DS class is the right answer for a
// list you configure things from and the wrong one for a feed you read.
//
// Not `.topics-card` itself: that class carries a 664px max-width sized to the
// feed's own two-card column and an absolutely-positioned kebab corner, neither
// of which a 380px rail wants. Same conventions, own class, and the conventions
// are cited where they are borrowed.
//
// The items are real <button>s — the rail is this page's primary navigation, and
// a div with role="button" buys keyboard access only by hand.
export function renderRail({ header, rows, selected, footer = "" }) {
  const items = rows
    .map((r) => {
      const on = r.id === selected;
      return `
      <button
        type="button"
        class="insights-rail__card${on ? " is-reading" : ""}"
        data-insights-row="${escapeAttr(r.id)}"
        aria-pressed="${on ? "true" : "false"}"
      >
        <span class="insights-rail__meta">
          ${r.meta}
          <span class="insights-rail__spacer"></span>
          <span class="insights-rail__figure">
            ${escapeText(String(r.figure))}${
              r.figureLabel ? `<span class="insights-rail__figure-unit">${escapeText(r.figureLabel)}</span>` : ""
            }
          </span>
        </span>
        <span class="insights-rail__name">${escapeText(r.name)}</span>
        ${r.note ? `<span class="insights-rail__note-line">${r.note}</span>` : ""}
      </button>`;
    })
    .join("");

  return `
    <div class="insights-rail">
      <p class="insights-rail__header">${escapeText(header)}</p>
      <div class="insights-rail__items">${items}</div>
      ${footer ? `<div class="insights-rail__footer">${footer}</div>` : ""}
    </div>`;
}

// ── The panel's goal rows ───────────────────────────────────────────────────
// Always on 30 days and it says so, whatever the selector reads. A goal target is
// monthly; restating it against a week would compare a number to a target it was
// never set against, which is the one thing this page is written not to do.
export function renderGoals(objectives) {
  if (objectives.length === 0) return "";
  const rows = objectives
    .map(
      (o) => `
      <div class="insights-goal">
        <span class="insights-goal__name">${escapeText(o.objective)}</span>
        <span class="insights-goal__track">
          <span
            class="insights-goal__fill insights-goal__fill--${escapeAttr(o.tier)}"
            style="width: ${Math.min(100, o.progress)}%"
          ></span>
        </span>
        <span class="insights-figure insights-goal__value">${escapeText(o.value)} / ${escapeText(o.goal)}</span>
        ${renderTrend(o.variationPercent, { suffix: " · 30d" })}
      </div>`,
    )
    .join("");

  return `<div class="insights-panel__goals">${rows}</div>`;
}

// ── "What worked here" ──────────────────────────────────────────────────────
// One post, as evidence for the paragraph above it. Never a list: the panel's job
// is a diagnosis, and a second post is a second argument.
export function renderWhatWorked(worked, { title = "What worked here" } = {}) {
  if (!worked) return "";
  return `
    <div class="insights-panel__block">
      <h4 class="insights-panel__block-title">${escapeText(title)}</h4>
      <div class="insights-post">
        <span class="insights-post__origin">${escapeText(worked.network)} · ${escapeText(worked.date)}</span>
        <span class="insights-post__excerpt">${escapeText(worked.excerpt)}</span>
        <span class="insights-figure insights-post__figure">
          ${escapeText(worked.views)} · <span class="insights-post__multiple">${escapeText(worked.multiple)}</span> median
        </span>
      </div>
    </div>`;
}

// ── The Report Studio bridge ────────────────────────────────────────────────
// The only bridge out, and conditional rather than a wall: it appears where the
// limit actually bites and says which limit. Never an export button — the
// shareable month-end document is Report Studio's job, and offering a download
// here would promise one this page cannot make.
//
// The highlighted phrase is what the platform adds, marked in butter so the
// sentence carries the boundary rather than the button.
export function renderBridge({ before, highlight, after, cta }) {
  return `
    <div class="insights-bridge">
      <p class="insights-bridge__text">
        ${escapeText(before)}
        <span class="insights-bridge__highlight">${escapeText(highlight)}</span>
        ${escapeText(after)}
      </p>
      <button type="button" class="ap-button transparent insights-bridge__cta" data-insights-bridge>
        <span>${escapeText(cta)}</span><i class="ap-icon-arrow-right" aria-hidden="true"></i>
      </button>
    </div>`;
}

// ── The cap ─────────────────────────────────────────────────────────────────
// Stated once, at 60 days, where the window ends — not on every widget. This is
// the one honest upsell moment on Performance.
export function renderCapNote(period, { startedOn }) {
  if (!isAtCap(period)) return "";
  return `
    <p class="insights-cap">
      60 days is all Archie keeps — this reads from ${escapeText(startedOn)}. A year of this curve is an
      <button type="button" class="ap-link small insights-cap__link" data-insights-bridge>Agorapulse view</button>.
    </p>`;
}

/** Grouped thousands, the way every figure on this page reads. */
export function figure(n) {
  return formatGroupedNumber(n);
}

// ── E1, nothing published yet ───────────────────────────────────────────────
// One per tab, because each answers a different question and therefore has a
// different thing it is waiting for. What they share is the rule: name the
// MECHANISM, not the absence. No zeros, no empty tables, and no upsell — there is
// nothing to compare yet, so there is nothing the platform could add.
//
// Shared here rather than written three times because two of the three were
// missing it: Usage rendered a blank page and Value printed a ledger of noughts
// beside an authored "19 signals turned into work", which is the one thing a tab
// about being worth its price must never do.
const FIRST_RUN = {
  performance: {
    icon: "ap-icon-bar-graph",
    title: "No numbers yet — and that's correct.",
    body: "Insights fills itself from what I publish. Publish your first post and reach, engagement and verdicts appear here — each with its period.",
  },
  usage: {
    icon: "ap-icon-sparkles",
    title: "Nothing drafted yet.",
    body: "This half counts what I made for you — the drafts, the posts that shipped, the voice I learned on each brand. It starts filling from your first chat.",
  },
  value: {
    icon: "ap-icon-wallet",
    title: "Nothing to claim yet.",
    body: "This tab answers whether I'm worth my price, with figures you can check against the other two. It needs published posts before it can answer honestly — so it waits.",
  },
};

export function renderFirstRun(tab) {
  const copy = FIRST_RUN[tab] || FIRST_RUN.performance;
  return renderEmptyState({
    icon: copy.icon,
    title: copy.title,
    body: copy.body,
    wrapperClass: "insights-view__empty",
    actionHtml: `<button type="button" class="ap-button primary orange" data-insights-start-chat>
      <i class="ap-icon-plus"></i><span>Start a chat</span>
    </button>`,
  });
}
