// The objective detail — the Insights card (handoff 1a–1e), the loop's reading
// surface. Three named bands under one header:
//   • THE VERDICT — the headline read + Archie's one Next move (orange box, the
//     card's single primary action). Archie talks here, so first person.
//   • THE PROOF · N MEASURES — the weakest measure arrives expanded (pace +
//     trend charts, per-profile tiles, and the posts that carry it with a
//     Repurpose door); the rest are compact rows. Collecting objectives show
//     baseline-pending rows and no verdict.
//   • FROM YOUR FEED · N TOPICS — what's happening outside, tied to the
//     objective: a cause-badged card and creation angles.
// The ⋯ menu carries Adjust · Open the Playbook · View history; View history
// swaps the three bands for the objective's timeline (1e) without leaving the
// card.
//
// ONE component, two hosts: the List view renders it in place as the detail
// panel; the board opens it in the detail modal (which adds the ↑↓/✕ chrome).
// Hosts own the interactivity: data-objd-* clicks are handled by whoever
// rendered it, and hosts pass the transient view state (expandedId,
// historyView, historyFilter).

import { escapeHtml as esc, escapeAttr } from "../../utils.js?v=45";
import { measureState, isRateMetric, windowPhrase, profileSplit, measurePosts } from "../../objective-measures.js?v=7";
import { NETWORK_LABEL } from "../../social-profiles.js?v=85";
import { readingFor, weakestMeasure, paceCaption, trendCaption, sparklinePoints } from "./objectives-model.js?v=1";
import { nextMoveFor } from "../../objective-flow.js?v=1";
import {
  feedTopicsFor,
  feedCaption,
  historyFor,
  historyFilters,
  FEED_BADGE_TONE,
  HISTORY_DOT_CLASS,
} from "./objective-feed.js?v=1";
import { installMoreMenu } from "../../components/more-menu.js?v=15";

// The ⋯ menu is the shared kebab (Action Dropdown + more-menu): one document
// listener pair for open / click-outside / Escape, driven by the trigger's
// aria-controls. Installed once at import, like the cards do.
installMoreMenu({
  menuSelector: ".objd__more-menu",
  triggerSelector: "[data-objd-more]",
  closeAfterSelectors: ["[data-objd-adjust]", "[data-objd-history]"],
});

const STATE_TONE = { on: "green", soft: "yellow", off: "red" };
const STATUS_CLASS = {
  strong: "insights-verdict--strong",
  watch: "insights-verdict--watch",
  "at-risk": "insights-verdict--at-risk",
};

const PACE_LONG = {
  ahead: "AHEAD OF PACE",
  "on-pace": "ON PACE",
  behind: "BEHIND PACE",
  holding: "HOLDING",
  below: "BELOW THE BAR",
};
const TREND_LONG = { up: "TRENDING UP ↗", flat: "FLAT →", down: "TRENDING DOWN ↘" };

function verdictChips(m, { long = false } = {}) {
  const tone = STATE_TONE[measureState(m)] || "grey";
  const paceLabel = long ? PACE_LONG[m.pace?.id] || m.pace?.label : m.pace?.label;
  const trendLabel = long ? TREND_LONG[m.trend?.dir] || m.trend?.label : m.trend?.label;
  const paceTone = m.pace?.tone || tone;
  const trendTone = m.trend?.tone || tone;
  return `${paceLabel ? `<span class="ap-badge ${paceTone}">${esc(paceLabel)}</span>` : ""}${
    trendLabel ? `<span class="ap-badge ${trendTone}">${esc(trendLabel)}</span>` : ""
  }`;
}

function scopePhrase(m, entry) {
  if (!m.scope?.network) return "on all networks";
  const split = profileSplit(m, entry.ctxId);
  const names = split.map((p) => p.name).join(" + ");
  return `on ${names || NETWORK_LABEL[m.scope.network] || m.scope.network}`;
}

function trendTone(m) {
  return m.trend?.tone || "grey";
}

// The measures of the entry, proxy included for a parked objective.
export function detailMeasures(entry) {
  const r = entry.resolved;
  return r.status === "parked" ? [r.proxy] : r.measures;
}

export function defaultExpandedId(entry) {
  return weakestMeasure(entry)?.id || detailMeasures(entry)[0]?.id || null;
}

// One Action Dropdown row (Adjust / View history) — the DS item anatomy, with
// the data-attr the host's delegated handler listens for.
function menuItem({ attr, icon, label }) {
  return `
    <button type="button" class="ap-action-dropdown-item" role="menuitem" ${attr}>
      <i class="${icon}" aria-hidden="true"></i>
      <div class="ap-action-dropdown-item-text">
        <div class="ap-action-dropdown-item-label-container">
          <span class="ap-action-dropdown-item-label">${esc(label)}</span>
        </div>
      </div>
    </button>`;
}

// ── The header — shared by the reading and the history views ─────────────────
function renderHead(entry, host) {
  const r = entry.resolved;
  const v = entry.verdict;
  const eyebrow = [entry.playbookName, windowPhrase(r.window)].filter(Boolean).join(" · ");
  // Unique per objective — the trigger's aria-controls points at it. The key
  // carries "::" and spaces, neither id-safe, so collapse to a hyphen run.
  const menuId = `objd-more-${entry.key.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  const titleTail = entry.collecting
    ? `<span class="ap-badge grey objd__collectingtag">Collecting</span>`
    : v.tier
      ? `<span class="insights-verdict ${STATUS_CLASS[v.tier]}">${esc(v.label)}</span>${
          v.phrase ? `<span class="objd__ontrack">${esc(v.phrase)}</span>` : ""
        }`
      : "";
  return `
    <header class="objd__head${host === "modal" ? " objd__head--modal" : ""}">
      <span class="objd__eyebrow">
        <i class="ap-icon-target objd__eyebrowmark" aria-hidden="true"></i>
        <span class="objd__eyebrowtext">${esc(eyebrow)}</span>
      </span>
      <span class="objd__spacer"></span>
      <span class="objd__tag">Objective</span>
      <div class="objd__more-wrap">
        <button
          type="button"
          class="ap-icon-button transparent objd__more"
          data-objd-more
          aria-controls="${menuId}"
          aria-haspopup="menu"
          aria-expanded="false"
          aria-label="Objective actions"
        >
          <i class="ap-icon-more" aria-hidden="true"></i>
        </button>
        <div class="ap-action-dropdown objd__more-menu" id="${menuId}" role="menu" hidden>
          ${menuItem({ attr: "data-objd-adjust", icon: "ap-icon-pen", label: "Adjust" })}
          <a class="ap-action-dropdown-item" role="menuitem" href="#/playbook/${escapeAttr(entry.ctxId)}?section=objectives">
            <i class="ap-icon-target" aria-hidden="true"></i>
            <div class="ap-action-dropdown-item-text">
              <div class="ap-action-dropdown-item-label-container">
                <span class="ap-action-dropdown-item-label">Open the Playbook</span>
              </div>
            </div>
          </a>
          ${menuItem({ attr: "data-objd-history", icon: "ap-icon-clock", label: "View history" })}
        </div>
      </div>
    </header>
    <div class="objd__titleline">
      <h2 class="objd__title">${esc(entry.label)}</h2>
      ${titleTail}
    </div>`;
}

export function renderObjectiveDetail(
  entry,
  { expandedId = null, host = "panel", historyView = false, historyFilter = "all" } = {},
) {
  if (historyView) return renderHistoryView(entry, host, historyFilter);

  const r = entry.resolved;
  const parked = r.status === "parked";
  const reading = readingFor(entry);
  // null → the weakest measure opens (the default read); "none" → everything
  // folded, which is what a host passes when the reader closes the open one.
  const expanded = expandedId === "none" ? null : expandedId || defaultExpandedId(entry);
  const measures = detailMeasures(entry);

  const sections = measures
    .map((m) => {
      if (entry.collecting) return renderCollectingMeasure(m, entry);
      return m.id === expanded ? renderExpandedMeasure(m, entry, parked) : renderCollapsedMeasure(m, entry);
    })
    .join("");

  // The loop's exit (PP key flow 4): one recommendation, evidence-citing, and
  // the card's ONE primary action.
  const move = nextMoveFor(entry);
  const topics = feedTopicsFor(entry);
  const secondary =
    !entry.collecting && topics.length
      ? `<span class="objd__archiehint">Chat with the ${topics.length} feed topic${topics.length > 1 ? "s" : ""} attached ↓</span>`
      : "";
  const collectingNote =
    entry.collecting && reading.body ? `<p class="objd__verdictnote">${esc(reading.body)}</p>` : "";
  const verdictBand = `
    <section class="objd__band objd__verdict">
      <span class="objd__seclabel">The verdict</span>
      <p class="objd__headline">${esc(reading.headline)}</p>
      ${collectingNote}
      ${
        move
          ? `<div class="objd__archie">
        <img class="objd__archiemark" src="assets/logos/archie-mark-orange.svg" width="24" height="24" alt="Archie" />
        <div class="objd__archiebody">
          <p class="objd__archiepitch">${esc(move.pitch)}</p>
          <div class="objd__archieactions">
            <button type="button" class="ap-button primary orange" data-objd-next-chat>
              <span>${esc(move.cta)}</span>
            </button>
            ${secondary}
          </div>
        </div>
      </div>`
          : ""
      }
    </section>`;

  const proofLabel = entry.collecting
    ? `The proof · ${measures.length} measure${measures.length > 1 ? "s" : ""} · baseline pending`
    : `The proof · ${measures.length} measure${measures.length > 1 ? "s" : ""}`;
  const proofBand = `
    <section class="objd__band objd__proof">
      <span class="objd__seclabel">${esc(proofLabel)}</span>
      ${sections}
      ${renderProxyBanner(entry, parked)}
    </section>`;

  const feedBand = `
    <section class="objd__band objd__feed">
      <span class="objd__feedhead"><span class="objd__seclabel">From your feed · ${topics.length} topic${
        topics.length > 1 ? "s" : ""
      }</span><span class="objd__feedcaption">${esc(feedCaption(entry))}</span></span>
      <div class="objd__topics">${topics.map(renderTopicCard).join("")}</div>
    </section>`;

  return `
    <div class="objd" data-objd-key="${escapeAttr(entry.key)}">
      ${renderHead(entry, host)}
      ${verdictBand}
      ${proofBand}
      ${topics.length ? feedBand : ""}
    </div>`;
}

function renderProxyBanner(entry, parked) {
  if (!parked) return "";
  const r = entry.resolved;
  return `
    <div class="objd__proxybanner">
      <span>This objective is measured on a proxy — connect Google Analytics and it upgrades to <strong>${esc(
        r.soon.toLowerCase().includes("revenue") ? "attributed revenue" : "the real metric",
      )}</strong>, targets carried over.</span>
      <button type="button" class="ap-link standalone small objd__ga" data-objd-ga>Connect GA →</button>
    </div>`;
}

// ── From your feed ───────────────────────────────────────────────────────────
function renderTopicCard(t) {
  // The whole card is the affordance — one click opens the chat with the topic.
  return `
    <button type="button" class="objd__topic" data-objd-feed-chat aria-label="Start a chat about ${escapeAttr(t.title)}">
      <span class="ap-badge ${FEED_BADGE_TONE[t.badge.tone] || "grey"} objd__topicbadge">${esc(t.badge.text)}</span>
      <span class="objd__topictitle">${esc(t.title)}</span>
      <span class="objd__topicblurb">${esc(t.blurb)}</span>
      <span class="objd__topicmomentum">${esc(t.momentum)}</span>
      <span class="ap-link small objd__topicstart">Start a chat →</span>
    </button>`;
}

// ── The posts that carry a measure — inside the expanded measure box ──────────
function renderMeasurePosts(m, entry) {
  const posts = measurePosts(m.metricId, entry.ctxId);
  if (!posts.length) return "";
  return `
    <div class="objd__posts">
      <span class="objd__postslabel">The posts that carry this measure</span>
      ${posts
        .map(
          (p) => `
          <div class="objd__post">
            <span class="objd__post-meta">${esc(p.network)} · ${esc(p.date)}</span>
            <span class="objd__post-excerpt">${esc(p.excerpt)}</span>
            <span class="objd__post-figure">${esc(p.figure)} · <strong>${esc(p.multiple)}</strong></span>
            <button type="button" class="ap-button stroked grey objd__repurpose" data-objd-repurpose="${escapeAttr(p.excerpt)}">Repurpose</button>
          </div>`,
        )
        .join("")}
    </div>`;
}

function renderExpandedMeasure(m, entry, parked) {
  const rate = isRateMetric(m.metricId);
  const tone = STATE_TONE[measureState(m)] || "grey";
  const proxyBadge = parked ? `<span class="ap-badge grey">PROXY · ${esc(entry.label.toUpperCase())}</span>` : "";
  const scope = `${scopePhrase(m, entry)} · window: ${m.window.inherited ? "same as objective" : windowPhrase(m.window, { form: "short" })}`;
  const counter = rate
    ? `<span class="objd__big">${esc(m.baselineValue)}</span><span class="objd__of">vs ${esc(m.target || "—")}</span>`
    : `<span class="objd__big">${esc(m.baselineValue)}</span><span class="objd__of">/ ${esc(m.target || "—")}</span>`;
  const pct =
    m.progressPct != null ? `<span class="objd__pct objd__pct--${tone}">${m.progressPct}% of target</span>` : "";
  // Pace (left) and trend (right) share one grid so their charts sit on the same
  // bottom line and their captions on the same row — the two columns can't drift.
  return `
    <section class="objd__section objd__measure">
      <div class="objd__mhead">
        <button type="button" class="objd__mtoggle" data-objd-measure-toggle="${escapeAttr(m.id)}" aria-expanded="true" aria-label="Collapse ${esc(m.metricLabel)}">
          <i class="ap-icon-chevron-up" aria-hidden="true"></i>
        </button>
        <span class="objd__mname">${esc(m.metricLabel)}</span>
        ${proxyBadge}
        ${verdictChips(m, { long: true })}
        <span class="objd__spacer"></span>
        <span class="objd__mscope">${esc(scope)}</span>
      </div>
      <div class="objd__figures">
        <span class="objd__seclabel objd__fig-progresslabel">Progress</span>
        <span class="objd__seclabel objd__fig-trendlabel">Trend · 30d</span>
        <div class="objd__fig-pace">
          <div class="objd__counter">${counter}<span class="objd__spacer"></span>${pct}</div>
          <span class="objd__bigtrack" aria-hidden="true"><span class="objd__bigfill objd__bigfill--${tone}" style="width: ${m.progressPct ?? 0}%"></span></span>
        </div>
        <svg class="objd__spark objd__spark--${trendTone(m)} objd__fig-spark" viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${sparklinePoints(m.trend?.pct ?? 0)}"></polyline>
        </svg>
        <span class="objd__caption objd__fig-pacecap">${esc(paceCaption(m))}</span>
        <span class="objd__caption objd__fig-trendcap">${esc(trendCaption(m))}</span>
      </div>
      ${renderMeasurePosts(m, entry)}
    </section>`;
}

function renderCollapsedMeasure(m, entry) {
  const tone = STATE_TONE[measureState(m)] || "grey";
  const rate = isRateMetric(m.metricId);
  const value = rate
    ? `${esc(m.baselineValue)} vs ${esc(m.target || "—")}`
    : `${esc(m.baselineValue)} → ${esc(m.target || "—")}`;
  return `
    <section class="objd__section objd__mrow">
      <button type="button" class="objd__mtoggle" data-objd-measure-toggle="${escapeAttr(m.id)}" aria-expanded="false" aria-label="Expand ${esc(m.metricLabel)}">
        <i class="ap-icon-chevron-down" aria-hidden="true"></i>
      </button>
      <span class="objd__mname">${esc(m.metricLabel)}</span>
      ${verdictChips(m)}
      <span class="objd__spacer"></span>
      <span class="objd__minitrack" aria-hidden="true"><span class="objd__bigfill objd__bigfill--${tone}" style="width: ${m.progressPct ?? 0}%"></span></span>
      <span class="objd__mvalue">${value}</span>
    </section>`;
}

// A measure still in its grace window — no verdict, a striped track, and the
// day counter in place of a value (handoff 1d).
function renderCollectingMeasure(m, entry) {
  const g = entry.resolved.grace;
  const dayChip = g ? `<span class="ap-badge grey">COLLECTING · DAY ${g.day} OF ${g.of}</span>` : "";
  return `
    <section class="objd__section objd__mrow objd__mrow--collecting">
      <span class="objd__mname">${esc(m.metricLabel)}</span>
      ${dayChip}
      <span class="objd__spacer"></span>
      <span class="objd__mscope">${esc(scopePhrase(m, entry))}</span>
      <span class="objd__minitrack objd__minitrack--collecting" aria-hidden="true"></span>
      <span class="objd__mvalue objd__mvalue--pending">baseline pending</span>
    </section>`;
}

// ── View history (1e) — the body swaps, the header stays ──────────────────────
function renderHistoryView(entry, host, filter) {
  const events = historyFor(entry);
  const shown = filter && filter !== "all" ? events.filter((e) => e.kind === filter) : events;
  const since = events.length ? events[events.length - 1].date : "";
  const chips = historyFilters()
    .map(
      (f) => `
      <button type="button" class="ap-filter-chip" data-objd-history-filter="${f.id}" aria-pressed="${f.id === filter}">${esc(
        f.label,
      )}</button>`,
    )
    .join("");
  const rows = shown.length
    ? shown
        .map(
          (ev, i) => `
        <div class="objd__tlrow">
          <span class="objd__tlgutter">
            <span class="objd__tldot ${HISTORY_DOT_CLASS[ev.dot] || HISTORY_DOT_CLASS.grey}"></span>
            ${i < shown.length - 1 ? `<span class="objd__tlline"></span>` : ""}
          </span>
          <span class="objd__tlbody">
            <span class="objd__tlhead">
              <span class="objd__tldate">${esc(ev.date)}</span>
              <span class="objd__tltitle">${esc(ev.title)}</span>
              ${ev.tag ? `<span class="ap-badge ${ev.tag.tone || "grey"} objd__tltag">${esc(ev.tag.text)}</span>` : ""}
            </span>
            <span class="objd__tltext">${esc(ev.body)}${
              ev.link
                ? ` <button type="button" class="ap-link small objd__tllink" data-objd-feed-chat>${esc(ev.link.label)}</button>`
                : ""
            }</span>
          </span>
        </div>`,
        )
        .join("")
    : `<p class="objd__tlempty">Nothing of that kind yet.</p>`;
  return `
    <div class="objd" data-objd-key="${escapeAttr(entry.key)}">
      ${renderHead(entry, host)}
      <div class="objd__histbar">
        <button type="button" class="ap-link standalone small objd__histback" data-objd-history-back>
          <i class="ap-icon-arrow-left" aria-hidden="true"></i><span>Back to today</span>
        </button>
        <span class="objd__seclabel">History${since ? ` · since ${esc(since)}` : ""}</span>
        <span class="objd__spacer"></span>
        <span class="objd__histchips">${chips}</span>
      </div>
      <div class="objd__timeline">${rows}</div>
    </div>`;
}
