import { html, raw } from "../../utils.js?v=42";
import { renderTopbar, setTopbarActions, clearTopbarActions } from "../../components/topbar.js?v=507";
import { subscribe as subscribeContexts } from "../../contexts-store.js?v=94";
import { navigate } from "../../router.js?v=51";
import { renderPerformanceTab, bindPerformanceTab } from "./performance.js?v=37";
import { renderUsageTab } from "./usage.js?v=45";
import { mountWidgetCharts } from "../../report-widgets/widget-card.js?v=23";

// Insights — the portfolio layer above a single Playbook's detail, in two halves.
//
// This module knows their names, never their content: each entry owns what it
// renders and how it frames it.
//
// ── The page wears Archie's chrome, 2026-08-24 ──────────────────────────────
// It used to carry its own H1 ("Insights"), its own subtitle ("7 Playbooks") and
// its own `.ap-tabs` bar, while the topbar above it said "Archie". Two title bars
// on one screen, and the page looked like it came from another app.
//
// Now the topbar names the section (see currentTitle in topbar.js) and the switch
// rides in its LEAD slot as an `.ap-segmented-control` — the Topic Feed's own
// idiom, the same component in the same place. That is the whole change: nothing
// about the two halves' content moved, and the page gained back the ~96px its
// header cost above the fold.
//
// The header also used to carry a global "Review N objectives that need attention"
// button. That went earlier, and for its own reason: what has not been dealt with
// is counted where it arrives — the feed and the chat opening. The same number in
// two places ends up believed in neither.
//
// ── Performance leads, 2026-08-24 ──────────────────────────────────────────
// Usage was the landing half, on the argument that "the hub welcomes before it
// triages". That argument died the day triage moved to the feed and the chat
// opening: nobody arrives here to be triaged any more, they arrive to take stock.
// So the half that answers "how is it going" comes first, and the half that
// answers "what did Archie make me" follows it.
const TABS = [
  {
    id: "performance",
    label: "Performance",
    icon: "ap-icon-bar-graph",
    render: renderPerformanceTab,
    bind: bindPerformanceTab,
  },
  { id: "usage", label: "Usage", icon: "ap-icon-sparkles", render: renderUsageTab },
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

  teardown();
  // Lead slot only. Nothing goes in the actions slot on the right, and that is a
  // decision: this page compares every Playbook, so a Playbook picker there would
  // contradict what the page is for — and the period belongs to each half, which
  // states its own.
  setTopbarActions("", renderSegments(active));
  const paint = () => {
    target.innerHTML = html`<section class="screen insights-view">${raw(renderPage(active))}</section>`;
    mountWidgetCharts(target);
  };
  paint();
  bind(target, active);
  unsubscribe = subscribeContexts(paint);

  return teardown;
}

// `target` is the router's #app node, reused across every navigation rather
// than recreated — so a listener bound here outlives this mount unless
// something removes it before the next tab binds its own.
function teardown() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (unbindTab) unbindTab();
  unbindTab = null;
  // The screen owns what it put in the topbar, and the listener it bound on a node
  // outside its own root.
  clearTopbarActions();
  if (boundTopbar && onTopbarClick) boundTopbar.removeEventListener("click", onTopbarClick);
  boundTopbar = null;
  onTopbarClick = null;
}

function renderPage(active) {
  const tab = TABS.find((t) => t.id === active);
  return `<div class="insights-view__page">
      <div class="insights-view__panel">${tab.render()}</div>
    </div>`;
}

// The switch, in the topbar's lead slot — the Topic Feed's own control in the same
// place, so the two sections of Archie read as one app. Segments rather than the
// `.ap-tabs` bar this page used to draw: tabs belong to a panel inside a page, and
// this is a page-level switch that happens to change the whole body.
//
// They are BUTTONS and not links, unlike the tab bar they replace. That is the
// price of the segmented control: the DS draws segments as buttons, so the route
// change goes through a handler on #topbar instead of the router answering an
// href. Deep links still work — each half is its own URL — and the back button
// still walks them; only the mechanism moved.
function renderSegments(active) {
  const seg = (t) => {
    const on = t.id === active;
    return `
    <button
      type="button"
      class="ap-segmented-control__segment ${on ? "ap-segmented-control__segment--selected" : ""}"
      data-insights-segment="${t.id}"
      aria-pressed="${on ? "true" : "false"}"
    >
      <i class="${t.icon}" aria-hidden="true"></i>
      <span class="ap-segmented-control__label">${t.label}</span>
    </button>`;
  };
  return `<div class="ap-segmented-control insights-segments" role="group" aria-label="Which half of Insights to read">
      ${TABS.map(seg).join("")}
    </div>`;
}

// `#topbar` lives OUTSIDE `#app`, so a screen's delegated handler never reaches
// it: the segments need their own listener on that node, and the screen owns the
// teardown. Same contract the Topic Feed's segmented control runs under.
function bind(root, active) {
  unbindTab = TABS.find((t) => t.id === active)?.bind?.(root) || null;

  const topbar = document.getElementById("topbar");
  if (topbar) {
    onTopbarClick = (event) => {
      const seg = event.target.closest("[data-insights-segment]");
      if (!seg) return;
      const id = seg.dataset.insightsSegment;
      if (id !== active) navigate(`/insights/${id}`);
    };
    topbar.addEventListener("click", onTopbarClick);
    boundTopbar = topbar;
  }
}
