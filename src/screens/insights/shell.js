import { html, raw } from "../../utils.js?v=21";
import { renderTopbar } from "../../components/topbar.js?v=303";
import { getContexts, subscribe as subscribeContexts } from "../../contexts-store.js?v=53";
import { navigate } from "../../router.js?v=30";
import { flaggedCount } from "../../components/action-drawer.js?v=14";
import { renderPerformanceTab, bindPerformanceTab } from "./performance.js?v=16";
import { renderUsageTab } from "./usage.js?v=24";

// Insights — the portfolio layer above a single Playbook's detail, as two tabs.
//
// This module knows the tabs' names, never their content: each entry owns what it
// renders and how it frames it. The header holds the one thing true of every tab —
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
