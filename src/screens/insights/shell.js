import { html, raw, escapeAttr } from "../../utils.js?v=45";
import { renderTopbar } from "../../components/topbar.js?v=513";
import { subscribe as subscribeContexts } from "../../contexts-store.js?v=97";
import { navigate, getPath } from "../../router.js?v=54";
import { parseHashParams, setHashQuery } from "../../url-state.js?v=25";
import { renderObjectivesTab, bindObjectivesTab } from "./objectives.js?v=8";
import { renderUsageTab, bindUsageTab } from "./usage.js?v=65";
import { renderValueTab, bindValueTab } from "./value.js?v=13";
import { mountWidgetCharts } from "../../report-widgets/widget-card.js?v=26";
import { PERIODS, DEFAULT_PERIOD, periodFor } from "./insights-model.js?v=7";
import { isFlagOn } from "../../feature-flags.js?v=45";

// Insights — one page, one panel that changes job.
//
// It can answer three different questions: Objectives is "where do I stand",
// Usage is "what did Archie make", Value is "is this worth its price". Usage and
// Value ride the `insightsUsageValue` flag: while it is OFF (the default) the
// page IS Objectives — no tab bar, an "Insights and Objectives" header instead.
// Turn the flag ON and the three-tab bar returns, each tab a reading of one
// section.
//
// ── The chrome: back + title in the topbar, tabs (or the header) first in the
//    page ──────────────────────────────────────────────────────────────────
// The topbar leads with the way out (Back to new chat, via backTargetFor) and
// then names the section. When all three tabs are live the page opens on a real
// `.ap-tabs` bar — the DS's answer for switching readings of one section; when
// only Objectives is live the tab renders its own header (H1 + controls in one
// Playbooks-style row) and the shell adds no band above the panel.
//
// ── The period lives on the tab bar ─────────────────────────────────────────
// Right end of the `.ap-tabs-nav`, so one control rules whichever tab reads a
// window. It survived the move from the topbar's actions slot for the same
// reason it moved there: three copies of one control meant switching tabs
// silently changed the window you were reading.
//
// A Playbook picker still has no business up there — this page compares every
// Playbook, and the rail is how you choose one.
const TABS = [
  {
    id: "objectives",
    label: "Objectives",
    icon: "ap-icon-target",
    render: renderObjectivesTab,
    bind: bindObjectivesTab,
    // The board has no page-level window: every objective carries its OWN
    // (rolling 30d or a fixed end date), so the period selector would be a
    // control with nothing to control. Usage and Value keep it.
    noPeriod: true,
  },
  { id: "usage", label: "Usage", icon: "ap-icon-sparkles", render: renderUsageTab, bind: bindUsageTab },
  { id: "value", label: "Value", icon: "ap-icon-wallet", render: renderValueTab, bind: bindValueTab },
];

const DEFAULT_TAB = "objectives";

// Usage and Value ride the `insightsUsageValue` flag. While it is OFF (default)
// the page IS Objectives — the whole tab bar disappears and a single "Insights
// and Objectives" header takes its place; there is no second reading to switch
// to, so a one-tab bar would be a control with nothing to control.
function availableTabs() {
  return isFlagOn("insightsUsageValue") ? TABS : TABS.filter((t) => t.id === "objectives");
}

let unsubscribe = null;
let unbindTab = null;
let boundRoot = null;
let onRootClick = null;

export function renderInsights(params, target) {
  renderTopbar();
  const tabs = availableTabs();
  const showTabs = tabs.length > 1;
  // An unavailable tab (a stale /insights/usage while the flag is off, or a bad
  // id) falls back to Objectives — same redirect the router already relied on.
  const active = tabs.some((t) => t.id === params.tab) ? params.tab : DEFAULT_TAB;
  if (active !== params.tab) {
    navigate(`/insights/${DEFAULT_TAB}`);
    return () => {};
  }

  // The window rides in the URL rather than in a module variable, so a period is
  // part of what a shared link says — the page's own rule is that no figure appears
  // without its period, and a link that drops it breaks that on arrival.
  const period = periodFor(parseHashParams().get("period") || DEFAULT_PERIOD).id;

  teardown();
  const tab = TABS.find((t) => t.id === active);

  const paint = () => {
    // Tabs live → the shell owns the tab bar. Solo → the tab owns its own header
    // (the H1 + lede share a row with the reading controls, Playbooks-style), so
    // the shell adds nothing above the panel.
    const header = showTabs ? renderTabsBar(active, tab.noPeriod ? null : period) : "";
    target.innerHTML = html`<section class="screen insights-view">
      <div class="insights-view__page">
        ${raw(header)}
        <div class="insights-view__panel">${raw(tab.render(period))}</div>
      </div>
    </section>`;
    mountWidgetCharts(target);
  };
  paint();
  bind(target, active, period);
  unsubscribe = subscribeContexts(paint);

  return teardown;
}

// `target` is the router's #app node, reused across every navigation rather than
// recreated — so a listener bound here outlives this mount unless something removes
// it before the next tab binds its own.
function teardown() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (unbindTab) unbindTab();
  unbindTab = null;
  if (boundRoot && onRootClick) boundRoot.removeEventListener("click", onRootClick);
  boundRoot = null;
  onRootClick = null;
}

// A real `.ap-tabs` bar — the DS's own answer for switching readings of one
// section (the segmented control was a page-level switch idiom borrowed from
// the Topic Feed's topbar; the page owns a header row now, so tabs belong).
// BUTTONS, not links: deep links still work, each tab is its own URL, and the
// back button still walks them — only the mechanism differs. The period
// selector rides the right end of the same nav so the bar's border spans the
// full row; a spacer keeps it a composition of unmodified DS pieces.
function renderTabsBar(active, period) {
  const one = (t) => {
    const on = t.id === active;
    return `
    <button
      type="button"
      class="ap-tabs-tab${on ? " active" : ""}"
      role="tab"
      aria-selected="${on ? "true" : "false"}"
      data-insights-tab="${escapeAttr(t.id)}"
    >
      <i class="${t.icon}" aria-hidden="true"></i>
      <span>${t.label}</span>
    </button>`;
  };
  return `
    <div class="ap-tabs insights-view__tabs">
      <nav class="ap-tabs-nav" role="tablist" aria-label="Which question Insights answers">
        ${TABS.map(one).join("")}
        <span class="insights-view__tabspacer"></span>
        ${period ? renderPeriodSelector(period) : ""}
      </nav>
    </div>`;
}

// The single-view header (Usage & Value behind the flag) is rendered by the
// Objectives tab itself — it merges the H1 + lede with the reading controls in
// one Playbooks-style row (see renderComboHeader in objectives.js). Only
// Objectives is ever solo, so the tab owning that header keeps the controls'
// state and handlers where they live.

// 7 / 30 / 60, and 60 is the last one on purpose: it is where Archie's memory ends,
// not a choice about granularity. The panel says so inline when you get there.
//
// A real `.ap-segmented-control`, which is what the DS's own intent lookup answers
// for a toggle group. It was a hand-built `.insights-period` of `.ap-button`s with
// their border, radius and background stripped off — so this topbar carried two
// toggle groups painted two different ways, the tab switch marking its selection
// the DS way (border + text colour) and this one with a tinted fill the DS
// component explicitly does not use.
function renderPeriodSelector(active) {
  const items = PERIODS.map((p) => {
    const on = p.id === active;
    return `
    <button
      type="button"
      class="ap-segmented-control__segment ${on ? "ap-segmented-control__segment--selected" : ""}"
      data-insights-period="${escapeAttr(p.id)}"
      aria-pressed="${on ? "true" : "false"}"
    >
      <span class="ap-segmented-control__label">${p.label}</span>
    </button>`;
  }).join("");
  return `<div class="ap-segmented-control" role="group" aria-label="Window these figures cover">${items}</div>`;
}

// The tab bar and the period live INSIDE #app now, so one delegated listener on
// the root covers both. `root` is the router's #app node, reused across every
// navigation — the teardown removes this listener before the next screen binds.
function bind(root, active, period) {
  unbindTab = TABS.find((t) => t.id === active)?.bind?.(root, period) || null;

  onRootClick = (event) => {
    const tabBtn = event.target.closest("[data-insights-tab]");
    if (tabBtn) {
      const id = tabBtn.dataset.insightsTab;
      // The window survives the tab change: it is the reader's question about time,
      // and re-asking it on every tab is what made three copies of this control.
      if (id !== active) setHashQuery(`/insights/${id}`, period === DEFAULT_PERIOD ? {} : { period });
      return;
    }
    const p = event.target.closest("[data-insights-period]");
    if (p) {
      const id = p.dataset.insightsPeriod;
      if (id !== period) setHashQuery(getPath(), id === DEFAULT_PERIOD ? {} : { period: id });
    }
  };
  root.addEventListener("click", onRootClick);
  boundRoot = root;
}
