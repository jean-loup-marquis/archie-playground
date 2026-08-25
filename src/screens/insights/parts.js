import { escapeText, escapeAttr } from "../../utils.js?v=45";
import { renderEmptyState } from "../../components/empty-state.js?v=26";
import { renderWidgetCard } from "../../report-widgets/widget-card.js?v=26";
import { toOverviewData } from "../../report-widgets/widget-overview.js?v=25";
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

// ── The portfolio row ──────────────────────────────────────────────────────
// Four real Report Studio tiles, the same component the reading panel puts its
// three metrics in. That is the doc's own rule applied at the level where it was
// being broken: one metric = one widget, wired to a Report Studio widget behind.
//
// ── It was a strip, 2026-08-25 ─────────────────────────────────────────────
// One 14px grey band: "Across 7 Playbooks, last 30 days: 92,400 reached +2.9% on
// 6 that measure reach 318 posts 4.2% engagement 9 / 13 objectives on pace". A
// sentence pretending to be a dashboard row, and it failed as both:
//
//   · nothing separated the four figures, so where one ended was a guess;
//   · each label lived INSIDE its value as one mono string, so finding the
//     numbers meant reading the words — nothing was scannable;
//   · the reach caveat was glued to figure one and read as the start of figure two;
//   · it was the least prominent thing on the page while being the only answer at
//     portfolio level;
//   · the prefix spent ~215px restating the period the topbar already shows and
//     the Playbook count the rail already shows.
//
// Tiles fix all five at once, and the scope line above them says once what the
// prefix was saying inline. The tiles sit on the page's grey while the panel's sit
// inside its white card, so the two rows read as two layers rather than as peers.
export function renderPortfolio({ label, note, tiles }) {
  return `
    <section class="insights-portfolio" aria-label="${escapeAttr(label)}">
      <p class="insights-portfolio__scope">
        <span class="insights-portfolio__label">${escapeText(label)}</span>
        <span class="insights-portfolio__note">· ${escapeText(note)}</span>
      </p>
      ${renderPortfolioTiles(tiles)}
    </section>`;
}

// The bare grid, for a surface that states its own scope in prose above it — Value
// opens on a sentence and does not need a second scope line under it.
//
// ── No narrative, and no variation by default, 2026-08-25 ──────────────────
// Stripped HERE rather than left to each call site, so a tile cannot grow a second
// or third line back by being handed one. A portfolio row is a set of figures to
// compare at a glance, and a trend chip on one tile but not the next, or an italic
// caveat under one value, is what made the eye stop instead of scan. What those
// lines said lives in the prose that owns it: the scope line above the row, the
// panel's meta line, the goals block's own trends.
//
// `trends` is the one opt-in, and the reading panel is the one caller that takes
// it. Its three tiles are not a row to scan — they are the per-metric evidence for
// the diagnosis above them, and that diagnosis only partly restates them: the
// headline gives one figure's direction and the goals rows measure different
// metrics entirely, so on an At risk Playbook a flat Audience tile hid the only
// number moving the right way.
// `bodyHtml` is the one escape hatch, and it is the DS card's own: a tile whose
// value is a SHAPE rather than a figure (the keep-rate dial) substitutes the middle
// and keeps the card. Without it Usage had to draw its own grid around a hand-made
// gauge plus a nested call to this one — a grid inside a grid.
export function renderPortfolioTiles(tiles, { className = "", trends = false } = {}) {
  const cards = tiles
    .map((t) => {
      const { variation, narrative, bodyHtml, ...figure } = t;
      const data = trends && variation !== undefined ? { ...figure, variation } : figure;
      return renderWidgetCard({ overviewData: toOverviewData(data), bodyHtml }, { size: "mini" });
    })
    .join("");
  return `<div class="insights-portfolio__tiles${className ? ` ${escapeAttr(className)}` : ""}">${cards}</div>`;
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
//
// `aria-current`, NOT `aria-pressed`. They carried aria-pressed, which announces a
// toggle button that happens to be on — seven independent switches. This is a
// single-select list whose choice drives the panel beside it, and "current item in
// a set" is exactly what aria-current says. The list wrapper carries the set: a
// button on its own tells a screen reader nothing about how many there are or
// where in them it sits.
export function renderRail({ header, rows, selected, footer = "" }) {
  const items = rows
    .map((r) => {
      const on = r.id === selected;
      return `
      <li class="insights-rail__item" role="listitem">
      <button
        type="button"
        class="insights-rail__card${on ? " is-reading" : ""}"
        data-insights-row="${escapeAttr(r.id)}"
        ${on ? 'aria-current="true"' : ""}
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
      </button>
      </li>`;
    })
    .join("");

  return `
    <nav class="insights-rail" aria-label="${escapeAttr(header)}">
      <p class="insights-rail__header" id="insights-rail-header">${escapeText(header)}</p>
      <ul class="insights-rail__items" aria-labelledby="insights-rail-header">${items}</ul>
      ${footer ? `<div class="insights-rail__footer">${footer}</div>` : ""}
    </nav>`;
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
      <h3 class="insights-panel__block-title">${escapeText(title)}</h3>
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
