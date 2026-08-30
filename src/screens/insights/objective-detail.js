// The objective detail (handoff 6a) — everything the compact card summarizes,
// unfolded: the narrative reading, then ONE SECTION PER MEASURE — the weakest
// arrives expanded (both verdicts pace + trend with the caption naming which
// figure feeds which, the real scope, the per-profile breakdown with the
// out-of-scope networks as dashed tiles), the others as compact collapsed
// rows. Then the posts that carry the expanded measure, and the proxy banner
// when the objective lives on one.
//
// ONE component, two hosts: the List view renders it in place as the detail
// panel; the board opens it in the detail modal (which adds the ↑↓/✕ chrome).
// Hosts own the interactivity: data-objd-* clicks are handled by whoever
// rendered it.

import { escapeHtml as esc, escapeAttr } from "../../utils.js?v=45";
import {
  measureState,
  isRateMetric,
  windowPhrase,
  profileSplit,
  outOfScopeNetworks,
  measurePosts,
} from "../../objective-measures.js?v=7";
import { NETWORK_LABEL } from "../../social-profiles.js?v=85";
import { readingFor, weakestMeasure, paceCaption, trendCaption, sparklinePoints } from "./objectives-model.js?v=1";

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

export function renderObjectiveDetail(entry, { expandedId = null, host = "panel" } = {}) {
  const r = entry.resolved;
  const parked = r.status === "parked";
  const v = entry.verdict;
  const reading = readingFor(entry);
  // null → the weakest measure opens (the default read); "none" → everything
  // folded, which is what a host passes when the reader closes the open one.
  const expanded = expandedId === "none" ? null : expandedId || defaultExpandedId(entry);
  const measures = detailMeasures(entry);
  const status = entry.collecting
    ? `<span class="insights-verdict objd__status--collecting">Collecting</span>`
    : v.tier
      ? `<span class="insights-verdict ${STATUS_CLASS[v.tier]}">${esc(v.label)}</span>`
      : "";
  const subtitle = [entry.playbookName, windowPhrase(r.window), entry.collecting ? v.phrase : v.phrase]
    .filter(Boolean)
    .join(" · ");

  const sections = measures
    .map((m) => (m.id === expanded ? renderExpandedMeasure(m, entry, parked) : renderCollapsedMeasure(m, entry)))
    .join("");

  const expandedMeasure = measures.find((m) => m.id === expanded);
  const posts = expandedMeasure ? measurePosts(expandedMeasure.metricId, entry.ctxId) : [];
  const postsBlock = posts.length
    ? `
    <div class="objd__section">
      <span class="objd__seclabel">The posts that carry this measure</span>
      ${posts
        .map(
          (p) => `
          <div class="objd__post">
            <span class="objd__post-meta">${esc(p.network)} · ${esc(p.date)}</span>
            <span class="objd__post-excerpt">${esc(p.excerpt)}</span>
            <span class="objd__post-figure">${esc(p.figure)} · <strong>${esc(p.multiple)}</strong></span>
          </div>`,
        )
        .join("")}
    </div>`
    : "";

  const proxyBanner = parked
    ? `
    <div class="objd__proxybanner">
      <span>This objective is measured on a proxy — connect Google Analytics and it upgrades to <strong>${esc(
        r.soon.toLowerCase().includes("revenue") ? "attributed revenue" : "the real metric",
      )}</strong>, targets carried over.</span>
      <button type="button" class="ap-link standalone small objd__ga" data-objd-ga>Connect GA →</button>
    </div>`
    : "";

  return `
    <div class="objd" data-objd-key="${escapeAttr(entry.key)}">
      <header class="objd__head${host === "modal" ? " objd__head--modal" : ""}">
        <div class="objd__id">
          <h2 class="objd__title">${esc(entry.label)} ${status}</h2>
          <p class="objd__subtitle">${esc(subtitle)}</p>
        </div>
        <button type="button" class="ap-button ghost grey objd__adjust" data-objd-adjust>
          <i class="ap-icon-pen" aria-hidden="true"></i><span>Adjust</span>
        </button>
        <a class="ap-link standalone small" href="#/playbook/${escapeAttr(entry.ctxId)}?section=objectives">
          Open the Playbook<i class="ap-icon-arrow-right" aria-hidden="true"></i>
        </a>
      </header>
      <p class="objd__headline">${esc(reading.headline)}</p>
      ${reading.body ? `<p class="objd__body">${esc(reading.body)}</p>` : ""}
      ${sections}
      ${postsBlock}
      ${proxyBanner}
    </div>`;
}

function renderExpandedMeasure(m, entry, parked) {
  const rate = isRateMetric(m.metricId);
  const tone = STATE_TONE[measureState(m)] || "grey";
  const proxyBadge = parked ? `<span class="ap-badge grey">PROXY · ${esc(entry.label.toUpperCase())}</span>` : "";
  const scope = `${scopePhrase(m, entry)} · window: ${m.window.inherited ? "same as objective" : windowPhrase(m.window, { form: "short" })}`;
  const tiles = profileSplit(m, entry.ctxId)
    .map(
      (p) => `
      <div class="objd__tile">
        <span class="objd__tile-label">${esc((p.name || "").toUpperCase())} · ${esc((NETWORK_LABEL[p.network] || p.network).toUpperCase())}</span>
        <span class="objd__tile-value">${esc(p.value)}
          <span class="objd__tile-delta objd__tile-delta--${p.trendPct > 0 ? "up" : p.trendPct < 0 ? "down" : "flat"}">${
            p.trendPct > 0 ? "+" : p.trendPct < 0 ? "−" : ""
          }${Math.abs(p.trendPct)}%</span>
        </span>
      </div>`,
    )
    .join("");
  const outTiles = outOfScopeNetworks(m)
    .map(
      (n) => `
      <div class="objd__tile objd__tile--out">
        <span>${esc(NETWORK_LABEL[n] || n)} isn't in this measure's scope</span>
      </div>`,
    )
    .join("");
  const counter = rate
    ? `<span class="objd__big">${esc(m.baselineValue)}</span><span class="objd__of">vs ${esc(m.target || "—")}</span>`
    : `<span class="objd__big">${esc(m.baselineValue)}</span><span class="objd__of">/ ${esc(m.target || "—")}</span>`;
  const pct =
    m.progressPct != null ? `<span class="objd__pct objd__pct--${tone}">${m.progressPct}% of target</span>` : "";
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
        <div class="objd__pacecol">
          <div class="objd__counter">${counter}<span class="objd__spacer"></span>${pct}</div>
          <span class="objd__bigtrack"><span class="objd__bigfill objd__bigfill--${tone}" style="width: ${m.progressPct ?? 0}%"></span></span>
          <span class="objd__caption">${esc(paceCaption(m))}</span>
        </div>
        <div class="objd__trendcol">
          <span class="objd__seclabel">Trend · 30d</span>
          <svg class="objd__spark objd__spark--${trendTone(m)}" viewBox="0 0 200 44" aria-hidden="true">
            <polyline points="${sparklinePoints(m.trend?.pct ?? 0)}"></polyline>
          </svg>
          <span class="objd__caption objd__caption--${trendTone(m)}">${esc(trendCaption(m))}</span>
        </div>
      </div>
      <div class="objd__tiles">${tiles}${outTiles}</div>
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
      <span class="objd__mscope">${esc(scopePhrase(m, entry))}</span>
      <span class="objd__minitrack"><span class="objd__bigfill objd__bigfill--${tone}" style="width: ${m.progressPct ?? 0}%"></span></span>
      <span class="objd__mvalue">${value}</span>
    </section>`;
}
