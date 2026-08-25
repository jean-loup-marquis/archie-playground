import { html, raw, escapeAttr } from "../../utils.js?v=45";
import { renderTopbar, setTopbarActions, clearTopbarActions } from "../../components/topbar.js?v=510";
import { subscribe as subscribeContexts } from "../../contexts-store.js?v=97";
import { navigate, getPath } from "../../router.js?v=54";
import { parseHashParams, setHashQuery } from "../../url-state.js?v=25";
import { renderPerformanceTab, bindPerformanceTab } from "./performance.js?v=51";
import { renderUsageTab, bindUsageTab } from "./usage.js?v=59";
import { renderValueTab, bindValueTab } from "./value.js?v=7";
import { mountWidgetCharts } from "../../report-widgets/widget-card.js?v=26";
import { PERIODS, DEFAULT_PERIOD, periodFor } from "./insights-model.js?v=3";

// Insights — one page, three tabs, one panel that changes job.
//
// The three answer three different questions and that is the whole reason there
// are three: Performance is "where do I stand", Usage is "what did Archie make",
// Value is "is this worth its price". They were two, and the third question was
// being answered by whichever of the two looked best that month.
//
// ── The page wears Archie's chrome ──────────────────────────────────────────
// The topbar names the section and carries the switch in its LEAD slot as an
// `.ap-segmented-control` — the Topic Feed's own idiom, the same component in the
// same place. The page draws no header of its own.
//
// ── The period lives here, not in the tabs ──────────────────────────────────
// It is in the topbar's ACTIONS slot, which the previous pass deliberately left
// empty on the argument that "the period belongs to each half, which states its
// own". That held while the two halves measured different things over different
// windows. It stopped holding the moment all three tabs became the same
// master-detail over the same 7 / 30 / 60 window: three copies of one control, and
// switching tabs silently changed the window you were reading.
//
// A Playbook picker still has no business up there — this page compares every
// Playbook, and the rail is how you choose one.
const TABS = [
  {
    id: "performance",
    label: "Performance",
    icon: "ap-icon-bar-graph",
    render: renderPerformanceTab,
    bind: bindPerformanceTab,
  },
  { id: "usage", label: "Usage", icon: "ap-icon-sparkles", render: renderUsageTab, bind: bindUsageTab },
  { id: "value", label: "Value", icon: "ap-icon-wallet", render: renderValueTab, bind: bindValueTab },
];

const DEFAULT_TAB = "performance";

let unsubscribe = null;
let unbindTab = null;
let boundTopbar = null;
let onTopbarClick = null;

export function renderInsights(params, target) {
  renderTopbar();
  const active = TABS.some((t) => t.id === params.tab) ? params.tab : DEFAULT_TAB;
  if (active !== params.tab) {
    navigate(`/insights/${DEFAULT_TAB}`);
    return () => {};
  }

  // The window rides in the URL rather than in a module variable, so a period is
  // part of what a shared link says — the page's own rule is that no figure appears
  // without its period, and a link that drops it breaks that on arrival.
  const period = periodFor(parseHashParams().get("period") || DEFAULT_PERIOD).id;

  teardown();
  setTopbarActions(renderPeriodSelector(period), renderSegments(active));

  const paint = () => {
    target.innerHTML = html`<section class="screen insights-view">
      <div class="insights-view__page">
        <div class="insights-view__panel">${raw(TABS.find((t) => t.id === active).render(period))}</div>
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
  clearTopbarActions();
  if (boundTopbar && onTopbarClick) boundTopbar.removeEventListener("click", onTopbarClick);
  boundTopbar = null;
  onTopbarClick = null;
}

// Segments rather than a tab bar: tabs belong to a panel inside a page, and this is
// a page-level switch that happens to change the whole body. They are BUTTONS, not
// links, because the DS draws segments as buttons — deep links still work, each tab
// is its own URL, and the back button still walks them; only the mechanism moved.
function renderSegments(active) {
  const seg = (t) => {
    const on = t.id === active;
    return `
    <button
      type="button"
      class="ap-segmented-control__segment ${on ? "ap-segmented-control__segment--selected" : ""}"
      data-insights-segment="${escapeAttr(t.id)}"
      aria-pressed="${on ? "true" : "false"}"
    >
      <i class="${t.icon}" aria-hidden="true"></i>
      <span class="ap-segmented-control__label">${t.label}</span>
    </button>`;
  };
  return `<div class="ap-segmented-control insights-segments" role="group" aria-label="Which question Insights answers">
      ${TABS.map(seg).join("")}
    </div>`;
}

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

// `#topbar` lives OUTSIDE `#app`, so a screen's delegated handler never reaches it:
// the segments and the period need their own listener on that node, and the screen
// owns the teardown. Same contract the Topic Feed's segmented control runs under.
function bind(root, active, period) {
  unbindTab = TABS.find((t) => t.id === active)?.bind?.(root, period) || null;

  const topbar = document.getElementById("topbar");
  if (!topbar) return;
  onTopbarClick = (event) => {
    const seg = event.target.closest("[data-insights-segment]");
    if (seg) {
      const id = seg.dataset.insightsSegment;
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
  topbar.addEventListener("click", onTopbarClick);
  boundTopbar = topbar;
}
