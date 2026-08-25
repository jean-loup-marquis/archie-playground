import { escapeText, escapeAttr } from "../../utils.js?v=45";
import { getContexts } from "../../contexts-store.js?v=97";
import { insightsPanelFor, insightsHandled, playbookReportFor } from "../../mocks.js?v=115";
import { navigate } from "../../router.js?v=54";
import { renderWidgetCard } from "../../report-widgets/widget-card.js?v=26";
import { toOverviewData } from "../../report-widgets/widget-overview.js?v=25";
import { showToast } from "../../components/toast.js?v=44";
import { objectiveTier } from "../../objective-scoring.js?v=25";
import { alertState, mutedUntilLabel, reopen, subscribe as subscribeAlerts } from "../../objective-alerts-store.js?v=6";
import {
  performanceRows,
  performanceStrip,
  resolveSelection,
  allClear,
  periodLabel,
  isAtCap,
  scaleVolume,
} from "./insights-model.js?v=3";
import {
  renderRail,
  renderStrip,
  stripFigure,
  renderRing,
  renderGoals,
  renderWhatWorked,
  renderBridge,
  renderCapNote,
  renderTrend,
  renderFirstRun,
  verdictWord,
  figure,
} from "./parts.js?v=5";

// Insights › Performance — the doc's screens 4a and 6a.
//
// ── What this replaced, 2026-08-25 ──────────────────────────────────────────
// A stack: an editorial lead, a Report Studio infobox, a grid of seven health
// cards, the selected Playbook's six widgets, and a thirteen-row objectives table
// with two filter dropdowns. Five blocks answering one question between them, and
// the answer — "which Playbook should I look at" — was the block furthest down.
//
// It is now a master-detail: a ranked rail on the left, the selected Playbook's
// diagnosis on the right. Literally the Topic Feed's list-plus-panel, so the page
// reads as native rather than as a second design. What the table did, the rail's
// second line and the panel's goal rows do between them — and neither of them asks
// the reader to sort anything to find out where to look.
//
// ── The panel has two jobs and one anatomy ──────────────────────────────────
// At risk, Watch and Strong all draw the same panel: head, headline, body, meta,
// goals, three widgets, what worked. Switching Playbooks moves nothing. A Strong
// Playbook gains exactly one block, "What Archie brought here", tinted, and that
// block compares only inside Archie's own 60-day window: its own posts against its
// own previous month. No assembled baselines, because a baseline this page cannot
// see is a claim it cannot defend.

// Which three of the Playbook's six report metrics the panel shows. The doc's
// choice, and the reason is coverage: every network answers impressions,
// engagements and audience, so none of the three can render as a hole.
const PANEL_WIDGET_IDS = ["impressions", "engagements", "audience"];

let selected = null;

export function renderPerformanceTab(period) {
  const contexts = getContexts();
  if (contexts.length === 0) return renderFirstRun("performance");

  const rows = performanceRows();
  const activeId = resolveSelection(rows, selected);
  const active = rows.find((r) => r.id === activeId);
  const single = rows.length === 1;

  return `
    ${renderStripFor(period, rows.length)}
    <div class="insights-split${single ? " insights-split--single" : ""}">
      ${single ? "" : renderRailFor(rows, activeId)}
      <div class="insights-split__panel">
        ${allClear(rows) ? renderAllClear(rows, active) : ""}
        ${active ? renderPanel(active, period) : ""}
      </div>
    </div>`;
}

function renderStripFor(period, playbooks) {
  const strip = performanceStrip(period);
  return renderStrip({
    playbooks,
    period,
    note: strip.note,
    figures: [
      {
        // The reach figure names its own coverage when it is not every Playbook.
        // It is a sum of the reach goals the Playbooks declare, and a Playbook
        // without one contributes nothing — so the count is part of the figure,
        // not a footnote someone has to go looking for.
        html:
          stripFigure(`${figure(strip.reach)} reached`, { variation: strip.reachVariation }) +
          (strip.reachPlaybooks < strip.playbooks
            ? `<span class="insights-strip__coverage">on ${strip.reachPlaybooks} that measure reach</span>`
            : ""),
      },
      { html: stripFigure(`${figure(strip.posts)} posts`) },
      { html: stripFigure(`${strip.engagementRate}% engagement`) },
      { html: stripFigure(`${strip.onPace} / ${strip.objectives} objectives on pace`) },
    ],
  });
}

// E4 — with one Playbook there is no "where to look first", so the rail does not
// render a list of one. It comes back on its own at the second Playbook.
function renderRailFor(rows, activeId) {
  return renderRail({
    header: `${rows.length} Playbooks · where to look first`,
    selected: activeId,
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      figure: r.score,
      subtitle: `${verdictWord(r.tier)}<span class="insights-rail__reason"> · ${escapeText(r.reason)}</span>`,
    })),
    footer: renderHandled(),
  });
}

// The quiet journal. These signals left the feed and the chat opening once they
// were dealt with; this is where they are read again, as a record. It is the last
// thing in the rail and it asks for nothing — this page never solicits.
function renderHandled() {
  const entries = insightsHandled();
  if (entries.length === 0) return "";
  const items = entries
    .map(
      (h) =>
        `<span class="insights-handled__item">${escapeText(h.label)} — <span class="insights-handled__state insights-handled__state--${escapeAttr(h.state)}">${escapeText(h.state)}</span></span>`,
    )
    .join("");
  return `
    <div class="insights-handled">
      <span class="insights-handled__label">Handled</span>
      <span class="insights-handled__list">${items}</span>
    </div>`;
}

// E5 — everything Strong. Said once, above the panel, because a good month should
// read as one: the alternative is seven green rows and a reader wondering what
// they are supposed to do about them.
function renderAllClear(rows, active) {
  return `
    <div class="insights-allclear">
      <p class="insights-allclear__title">Nothing needs your hand this week.</p>
      <p class="insights-allclear__body">
        All ${rows.length} Playbooks are ${verdictWord("strong")}. The panel opens on your best trend —
        ${escapeText(active?.name || "")} — in proof mode.
      </p>
    </div>`;
}

function renderPanel(row, period) {
  const copy = insightsPanelFor(row.context);
  const objectives = row.objectives.map((o) => ({
    ...o,
    tier: objectiveTier(o.progress, o.variationPercent),
  }));

  return `
    <article class="ap-card insights-panel" data-insights-panel="${escapeAttr(row.id)}">
      <header class="insights-panel__head">
        ${renderRing(row.score, row.tier)}
        <div class="insights-panel__id">
          <h2 class="insights-panel__name">${escapeText(row.name)}</h2>
          <!-- The verdict says 30 days and NOT the selected window, on purpose. A
               verdict is a goal's progress against a monthly target, so it does not
               move when the reader asks for a week or two months — and printing
               "score 88 / 100 · last 60 days" beside a figure that did not change
               is exactly the kind of number this page is written not to print. The
               volume figures below carry the selected window instead. -->
          <p class="insights-panel__verdict">
            ${verdictWord(row.tier)}
            <span class="insights-panel__score"> · score ${row.score} / 100 · goals measured on 30 days</span>
          </p>
        </div>
        <a class="ap-link standalone small insights-panel__open" href="#/playbook/${escapeAttr(row.id)}">
          Open the Playbook<i class="ap-icon-arrow-right" aria-hidden="true"></i>
        </a>
      </header>
      ${copy ? `<p class="insights-panel__headline">${escapeText(copy.headline)}</p>` : ""}
      ${copy ? `<p class="insights-panel__body">${escapeText(copy.body)}</p>` : ""}
      ${copy ? `<p class="insights-panel__meta">${escapeText(copy.meta)} · ${escapeText(periodLabel(period))}</p>` : ""}
      ${renderGoals(objectives)}
      ${renderAlerts(row, objectives)}
      <div class="insights-panel__widgets">${renderPanelWidgets(row.context, period)}</div>
      ${renderCapNote(period, { startedOn: "Apr 25" })}
      ${copy?.proof ? renderProof(copy, period) : ""}
      ${renderWhatWorked(copy?.whatWorked, {
        title: copy?.proof ? "The post that made the case" : "What worked here",
      })}
      ${renderPanelBridge(row, copy, period)}
    </article>`;
}

// One metric, one widget, and the widget is a real Report Studio tile driven by the
// same overviewData contract the report uses — layout is ours, the data shape is
// theirs. `narrative` carries the period, which is how every figure here gets one.
function renderPanelWidgets(context, period) {
  const byId = new Map(playbookReportFor(context).map((w) => [w.id, w]));
  return PANEL_WIDGET_IDS.map((id) => {
    const w = byId.get(id);
    if (!w) return "";
    return renderWidgetCard(
      { overviewData: toOverviewData({ ...w, count: scaleVolume(w.count, period), narrative: periodLabel(period) }) },
      { size: "mini" },
    );
  }).join("");
}

// What the reader already did about an objective, which the numbers cannot say.
// The chat opening shows only what is still asking, so without this line a muted
// objective would have no surface at all — and bringing it back is one click,
// because the reader is the only one who knows they want asking again sooner.
function renderAlerts(row, objectives) {
  const muted = objectives
    .map((o) => ({ objective: o.objective, state: alertState(row.id, o.objective) }))
    .filter((a) => a.state !== "open");
  if (muted.length === 0) return "";

  const items = muted
    .map(
      (a) => `
      <span class="insights-muted__item">
        ${escapeText(a.objective)} —
        ${a.state === "muted" ? `muted ${escapeText(mutedUntilLabel(row.id))}` : "set aside"}
        <button
          type="button"
          class="ap-button transparent blue"
          data-alert-reopen="${escapeAttr(a.objective)}"
          data-alert-playbook="${escapeAttr(row.id)}"
        >
          <span>Bring back</span>
        </button>
      </span>`,
    )
    .join("");

  return `<div class="insights-muted">${items}</div>`;
}

// The one block a Strong Playbook gains. Tinted, so it reads as a different kind of
// claim than the diagnosis above it, and every figure in it compares Archie to
// Archie: its own posts this window against its own previous one.
function renderProof(copy, period) {
  const p = copy.proof;
  const before = scaleVolume(p.reachBefore, period);
  const after = scaleVolume(p.reachAfter, period);
  const posts = scaleVolume(p.posts, period);
  const through = scaleVolume(p.postsThrough, period);
  const total = scaleVolume(p.postsTotal, period);
  const hours = Math.round(((posts * 9) / 60) * 10) / 10;

  return `
    <div class="insights-panel__block insights-proof">
      <div class="insights-proof__head">
        <h4 class="insights-panel__block-title insights-proof__title">What Archie brought here</h4>
        <span class="insights-proof__scope">compared only inside my own window — no extra connections</span>
      </div>
      <div class="insights-proof__grid">
        <div class="insights-proof__card insights-proof__card--wide">
          <span class="insights-proof__label">Reach, vs the ${periodFigure(period)} before</span>
          <span class="insights-proof__bars">
            <span class="insights-proof__bar insights-proof__bar--before" style="width: 62%"></span>
            <span class="insights-proof__bar insights-proof__bar--after" style="width: 74%"></span>
          </span>
          <span class="insights-figure insights-proof__value">
            ${figure(before)} → ${figure(after)} ${renderTrend(p.reachVariation)}
          </span>
          <span class="insights-proof__note">both on my posts · inside my 60-day window</span>
        </div>
        <div class="insights-proof__card">
          <span class="insights-proof__label">Share of publishing</span>
          <span class="insights-figure insights-proof__big">${through} / ${total}</span>
          <span class="insights-proof__note">every post here went through me · ${escapeText(periodLabel(period))}</span>
        </div>
        <div class="insights-proof__card">
          <span class="insights-proof__label">Drafting time saved</span>
          <span class="insights-figure insights-proof__big">~${hours} h</span>
          <span class="insights-proof__note">at 9 min per accepted draft · ${escapeText(periodLabel(period))}</span>
        </div>
      </div>
    </div>`;
}

function periodFigure(period) {
  return periodLabel(period).replace("last ", "");
}

// Conditional, and it names the limit that actually bites here rather than a
// feature list. On a Strong Playbook the boundary is the claim's scope; on a
// struggling one it is the comparison the diagnosis could not make.
function renderPanelBridge(row, copy, period) {
  if (copy?.proof) {
    return renderBridge({
      before: `This proof covers my ${scaleVolume(copy.proof.posts, period)} posts. To claim the whole month —`,
      highlight: "native posts included",
      after: "— build the client report in Report Studio.",
      cta: "Build it in Report Studio",
    });
  }
  if (isAtCap(period)) return "";
  return renderBridge({
    before: "These numbers cover the posts I published here. Comparing them to",
    highlight: "everything else this brand publishes",
    after: "needs the platform — by construction.",
    cta: "Compare in Report Studio",
  });
}

function repaint(root, period) {
  const panel = root.querySelector(".insights-view__panel");
  if (panel) panel.innerHTML = renderPerformanceTab(period);
}

// Returns an unbind function: the shell mounts one tab at a time on a DOM node it
// reuses across navigations, so whoever binds has to hand back a way to remove it
// before the next tab binds on top.
export function bindPerformanceTab(root, period) {
  const onClick = (event) => {
    if (event.target.closest("[data-insights-bridge]")) {
      showToast("Report Studio isn't wired up in this prototype");
      return;
    }
    if (event.target.closest("[data-insights-start-chat]")) {
      navigate("/");
      return;
    }
    // Ahead of the rail handler: this button sits inside the panel, not the rail,
    // but the panel is inside the same delegated root.
    const reopenBtn = event.target.closest("[data-alert-reopen]");
    if (reopenBtn) {
      reopen(reopenBtn.dataset.alertPlaybook, reopenBtn.dataset.alertReopen);
      showToast("Back on the list — you'll see it when you open a chat on this Playbook");
      repaint(root, period);
      return;
    }
    const row = event.target.closest("[data-insights-row]");
    if (row) {
      selected = row.dataset.insightsRow;
      repaint(root, period);
    }
  };

  root.addEventListener("click", onClick);
  const offAlerts = subscribeAlerts(() => repaint(root, period));

  return () => {
    root.removeEventListener("click", onClick);
    offAlerts();
  };
}
