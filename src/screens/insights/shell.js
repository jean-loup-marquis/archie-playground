import { html, raw } from "../../utils.js?v=40";
import { renderTopbar } from "../../components/topbar.js?v=505";
import { getContexts, subscribe as subscribeContexts } from "../../contexts-store.js?v=92";
import { navigate } from "../../router.js?v=49";
import { renderPerformanceTab, bindPerformanceTab } from "./performance.js?v=35";
import { renderUsageTab } from "./usage.js?v=43";
import { mountWidgetCharts } from "../../report-widgets/widget-card.js?v=21";

// Insights — the portfolio layer above a single Playbook's detail, as two tabs.
//
// This module knows the tabs' names, never their content: each entry owns what it
// renders and how it frames it.
//
// The header used to carry a global "Review N objectives that need attention"
// button. It is gone, and that is a decision rather than a tidy-up: what has not
// been dealt with is counted in the nav, on the feed, where the things needing
// attention actually arrive. The same number in two places ends up believed in
// neither — and this page is where you come to READ, not to be chased.

const TABS = [
  { id: "usage", label: "Usage", icon: "ap-icon-sparkles", render: renderUsageTab },
  {
    id: "performance",
    label: "Performance",
    icon: "ap-icon-bar-graph",
    render: renderPerformanceTab,
    bind: bindPerformanceTab,
  },
];

const DEFAULT_TAB = "usage";

let unsubscribe = null;
let unbindTab = null;

export function renderInsights(params, target) {
  renderTopbar();
  const active = TABS.some((t) => t.id === params.tab) ? params.tab : DEFAULT_TAB;
  if (active !== params.tab) {
    navigate(`/insights/${DEFAULT_TAB}`);
    return () => {};
  }

  teardown();
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
}

function renderPage(active) {
  const tab = TABS.find((t) => t.id === active);
  return `
    <div class="insights-view__page">
      ${renderHead()}
      ${renderTabNav(active)}
      <div class="insights-view__panel">${tab.render()}</div>
    </div>`;
}

function renderHead() {
  return `
    <header class="insights-view__head">
      <div class="insights-view__head-text">
        <h1 class="insights-view__title">Insights</h1>
        <p class="insights-view__sub">${getContexts().length} Playbooks</p>
      </div>
    </header>`;
}

// Navigation, not the ARIA tab widget: each entry is its own URL, deep-linkable
// and walked by the back button. role="tab" would promise arrow-key navigation
// within one panel, and aria-controls would have to name a panel that is not in
// the DOM — only the active tab renders. aria-current is the whole
// contract a nav owes. `.ap-tabs` stays for the DS look, as content-workspace
// already uses it with no roles at all.
function renderTabNav(active) {
  const tabs = TABS.map(
    (t) => `
    <a
      class="ap-tabs-tab ${t.id === active ? "active" : ""}"
      href="#/insights/${t.id}"
      ${t.id === active ? 'aria-current="page"' : ""}
    >
      <i class="${t.icon}" aria-hidden="true"></i>
      <span>${t.label}</span>
    </a>`,
  ).join("");

  return `<nav class="ap-tabs" aria-label="Insights sections">
      <div class="ap-tabs-nav">${tabs}</div>
    </nav>`;
}

// The tab nav needs no handler: its entries are `#/` links, which the hash
// router already answers on hashchange. Only the active tab's own delegation
// gets bound here.
function bind(root, active) {
  unbindTab = TABS.find((t) => t.id === active)?.bind?.(root) || null;
}
