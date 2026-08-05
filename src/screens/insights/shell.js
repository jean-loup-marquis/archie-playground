import { html, raw } from "../../utils.js?v=21";
import { renderTopbar } from "../../components/topbar.js?v=298";
import { getContexts, subscribe as subscribeContexts } from "../../contexts-store.js?v=47";
import { navigate } from "../../router.js?v=30";
import { renderEmptyState } from "../../components/empty-state.js?v=1";
import { flaggedCount } from "../../components/action-drawer.js?v=8";
import { renderPerformanceTab, bindPerformanceTab } from "./performance.js?v=2";
import { renderUsageTab } from "./usage.js?v=1";

// Insights — the portfolio layer above a single Playbook's detail, as four tabs.
//
// This module knows the tabs' names, never their content: each entry owns its own
// rendering and its own period. The header holds the one thing true of every tab —
// that N objectives need attention — so a user who never leaves Usage still sees it.

const TABS = [
  { id: "usage", label: "Usage", icon: "ap-icon-sparkles", render: renderUsageTab },
  {
    id: "performance",
    label: "Performance",
    icon: "ap-icon-bar-graph",
    render: renderPerformanceTab,
    bind: bindPerformanceTab,
  },
  { id: "voice", label: "Voice", icon: "ap-icon-quote", render: renderVoicePlaceholder },
  { id: "team", label: "Team", icon: "ap-icon-user", render: renderTeamPlaceholder },
];

const DEFAULT_TAB = "usage";

let unsubscribe = null;

export function renderInsights(params, target) {
  renderTopbar();
  const active = TABS.some((t) => t.id === params.tab) ? params.tab : DEFAULT_TAB;
  if (active !== params.tab) {
    navigate(`/insights/${DEFAULT_TAB}`);
    return () => {};
  }

  if (unsubscribe) unsubscribe();
  const paint = () => {
    target.innerHTML = html`<section class="screen insights-view">${raw(renderPage(active))}</section>`;
    bind(target, active);
  };
  paint();
  unsubscribe = subscribeContexts(paint);

  return () => {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  };
}

function renderPage(active) {
  const tab = TABS.find((t) => t.id === active);
  return `
    <div class="insights-view__page">
      ${renderHead()}
      ${renderTabNav(active)}
      <div
        class="insights-view__panel"
        role="tabpanel"
        id="insights-panel-${active}"
        aria-labelledby="insights-tab-${active}"
      >
        ${tab.render()}
      </div>
    </div>`;
}

// The one action on the page, and the only place the count appears. Orange primary is
// what the DS reserves for AI actions, and this opens Archie's recommendations.
function renderHead() {
  const flagged = flaggedCount();
  const cta =
    flagged > 0
      ? `<button type="button" class="ap-button primary orange insights-view__cta" data-open-action-drawer>
          <i class="ap-icon-sparkles" aria-hidden="true"></i>
          <span>Review ${flagged} ${flagged === 1 ? "objective" : "objectives"} that need${flagged === 1 ? "s" : ""} attention</span>
        </button>`
      : `<p class="insights-view__all-clear">
          <i class="ap-icon-check" aria-hidden="true"></i>
          Every objective is on track
        </p>`;

  return `
    <header class="insights-view__head">
      <div class="insights-view__head-text">
        <h1 class="insights-view__title">Insights</h1>
        <p class="insights-view__sub">${getContexts().length} Playbooks</p>
      </div>
      ${cta}
    </header>`;
}

function renderTabNav(active) {
  const tabs = TABS.map(
    (t) => `
    <button
      type="button"
      class="ap-tabs-tab ${t.id === active ? "active" : ""}"
      role="tab"
      id="insights-tab-${t.id}"
      aria-selected="${t.id === active}"
      aria-controls="insights-panel-${t.id}"
      data-insights-tab="${t.id}"
    >
      <i class="${t.icon}" aria-hidden="true"></i>
      <span>${t.label}</span>
    </button>`,
  ).join("");

  return `<div class="ap-tabs insights-view__tabs"><div class="ap-tabs-nav" role="tablist">${tabs}</div></div>`;
}

function renderVoicePlaceholder() {
  return renderEmptyState({
    icon: "ap-icon-quote",
    title: "Voice is coming",
    body: "A portfolio view of your brand voice across Playbooks — what recurs, what diverges, what Archie avoids.",
    wrapperClass: "insights-view__empty",
  });
}

function renderTeamPlaceholder() {
  return renderEmptyState({
    icon: "ap-icon-user",
    title: "Team is coming",
    body: "Who uses Archie across the organisation.",
    wrapperClass: "insights-view__empty",
  });
}

// Tabs navigate rather than mutating local state, so the back button walks them.
function bind(root, active) {
  root.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-insights-tab]");
    if (tab) navigate(`/insights/${tab.dataset.insightsTab}`);
  });
  TABS.find((t) => t.id === active)?.bind?.(root);
}
