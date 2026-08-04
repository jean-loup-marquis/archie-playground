import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=21";
import { escapeText, escapeAttr } from "../utils.js?v=21";
import { getContexts } from "../contexts-store.js?v=45";
import { objectiveCardsFor } from "../mocks.js?v=71";
import { objectiveTier, TIER_LABELS, TIER_STATUS_CLASS } from "../objective-scoring.js?v=1";
import { showToast } from "./toast.js?v=20";

// Shared action drawer — "what do I actually do about it?".
//
// The hub and a Playbook's Goals & Objectives both surface flagged objectives,
// and both dead-ended: you could see the problem and not act on it. This is the
// one place that answers, invoked from both, so the answer never forks.
//
// NOTE it is an overlay of its own and NOT `right-panel.js`: that panel is a
// column of the #appShell grid, a singleton with one mode at a time, and its
// syncFromUrl() force-closes it on any route outside ^/session/. None of that
// survives a drawer that has to open on /analytics and on /playbook/:id.
//
// Scope follows the door you came in by — opened from a Playbook it starts
// narrowed to that Playbook, from the hub it starts on everything — because the
// question you're asking is different in each case. The toggle covers the rest.
//
// Public API:
//   init()
//   open({ contextId })   — contextId omitted ⇒ portfolio scope
//   flaggedCount({ contextId })  — for the trigger badges

const MODAL_ID = "action-drawer";

// Signal → levers. Keyed by the objective's own metric, because "reach is
// stalling" and "clicks are short of goal" are different problems even when both
// read At risk. Every lever is inert in this prototype: none of the underlying
// mechanisms (Ambassador push, paid boost, native resurface, Content Ideation)
// exists here, so clicking says so rather than pretending.
const LEVERS = {
  reach: ["Reshare top post", "Repurpose cross-platform", "Boost with ads"],
  "engagement rate": ["Reply to comments", "Rebalance format mix"],
  "new followers": ["Push via Ambassador", "Reshare to new segments"],
  "CTA clicks": ["Get content ideas", "Test a new hook"],
};

let backdrop, drawer, listEl, titleEl, scopeEl;
let initialized = false;
let scopeContextId = null;
let openedFromContextId = null;

const HTML = `
  <div class="action-drawer__backdrop" data-drawer-backdrop hidden></div>
  <aside
    class="action-drawer"
    data-drawer
    role="dialog"
    aria-modal="true"
    aria-labelledby="actionDrawerTitle"
    aria-hidden="true"
  >
    <header class="action-drawer__head">
      <h2 class="action-drawer__title" id="actionDrawerTitle" data-drawer-title>Recommended actions</h2>
      <button type="button" class="ap-icon-button transparent grey" data-drawer-close aria-label="Close">
        <i class="ap-icon-close"></i>
      </button>
    </header>
    <div class="action-drawer__scope" role="group" aria-label="Scope" data-drawer-scope></div>
    <div class="action-drawer__body" data-drawer-list></div>
  </aside>`;

function injectOnce() {
  if (initialized) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  document.body.appendChild(wrapper);

  backdrop = wrapper.querySelector("[data-drawer-backdrop]");
  drawer = wrapper.querySelector("[data-drawer]");
  listEl = wrapper.querySelector("[data-drawer-list]");
  titleEl = wrapper.querySelector("[data-drawer-title]");
  scopeEl = wrapper.querySelector("[data-drawer-scope]");

  wrapper.addEventListener("click", (event) => {
    if (event.target.closest("[data-drawer-close]")) {
      close();
      return;
    }
    const scopeBtn = event.target.closest("[data-drawer-set-scope]");
    if (scopeBtn) {
      const raw = scopeBtn.dataset.drawerSetScope;
      scopeContextId = raw === "all" ? null : raw;
      paint();
      return;
    }
    const lever = event.target.closest("[data-drawer-lever]");
    if (lever) showToast(`"${lever.dataset.drawerLever}" isn't built yet`);
  });

  bindOverlayDismissal({ modal: drawer, backdrop, close, isOpen: () => drawer.classList.contains("open") });

  // The drawer owns its own triggers, delegated from the document: any screen
  // opens it by rendering `[data-open-action-drawer]` (optionally carrying a
  // `data-context-id` to scope it) and wires nothing. Deliberate — routing this
  // through each screen's own delegation made the trigger inherit that screen's
  // health, and on /playbook/:id the panel's delegation is currently dead
  // because a throw in its paint() runs before mount() binds any listener.
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-action-drawer]");
    if (!trigger) return;
    open({ contextId: trigger.dataset.contextId || null });
  });

  initialized = true;
}

// One row per objective that isn't Strong, worst first.
function flaggedRows(contextId) {
  return getContexts()
    .filter((c) => !contextId || c.id === contextId)
    .flatMap((c) =>
      objectiveCardsFor(c)
        .map((o) => ({ ...o, tier: objectiveTier(o.progress, o.variationPercent), playbookName: c.name }))
        .filter((o) => o.tier !== "strong"),
    )
    .sort((a, b) => (a.tier === b.tier ? a.progress - b.progress : a.tier === "at-risk" ? -1 : 1));
}

export function flaggedCount({ contextId = null } = {}) {
  return flaggedRows(contextId).length;
}

// Says what's wrong in one line, from the numbers rather than a lookup table —
// progress and trend are the only two things that can be wrong here.
//
// Phrased "Metric: 52% of goal" rather than "<metric> is at 52%" because the
// metric names carry mixed number ("reach" vs "CTA clicks") and no single verb
// agrees with all of them.
function diagnosisFor(o) {
  const metric = o.metric.charAt(0).toUpperCase() + o.metric.slice(1);
  const shortfall = `${metric}: ${o.progress}% of goal`;
  if (o.variationPercent < 0) return `${shortfall}, falling ${Math.abs(o.variationPercent)}% — the gap is widening.`;
  if (o.variationPercent === 0) return `${shortfall}, flat — nothing is closing it.`;
  return `${shortfall}, rising ${o.variationPercent}% — on the way, but not there yet.`;
}

function renderRow(o) {
  const levers = (LEVERS[o.metric] || [])
    .map(
      (l) =>
        `<button type="button" class="ap-button stroked grey action-drawer__lever" data-drawer-lever="${escapeAttr(l)}">${escapeText(l)}</button>`,
    )
    .join("");

  return `
    <article class="action-drawer__row action-drawer__row--${o.tier}">
      <div class="action-drawer__row-head">
        <span class="action-drawer__objective">${escapeText(o.objective)}</span>
        <span class="ap-status ${TIER_STATUS_CLASS[o.tier]} no-dot">${TIER_LABELS[o.tier]}</span>
      </div>
      <span class="action-drawer__playbook">${escapeText(o.playbookName)}</span>
      <p class="action-drawer__diagnosis">${escapeText(diagnosisFor(o))}</p>
      <div class="action-drawer__levers">${levers}</div>
    </article>`;
}

function paint() {
  const rows = flaggedRows(scopeContextId);
  const count = rows.length;
  titleEl.textContent = count === 1 ? "1 objective needs attention" : `${count} objectives need attention`;

  // The toggle only earns its place when you arrived from a Playbook — from the
  // hub there is nothing to narrow to.
  if (openedFromContextId) {
    const name = getContexts().find((c) => c.id === openedFromContextId)?.name || "This Playbook";
    scopeEl.hidden = false;
    scopeEl.innerHTML = [
      { id: openedFromContextId, label: name },
      { id: "all", label: "All Playbooks" },
    ]
      .map(
        (opt) => `
        <button
          type="button"
          class="ap-filter-chip"
          aria-pressed="${(scopeContextId || "all") === opt.id}"
          data-drawer-set-scope="${escapeAttr(opt.id)}"
        >${escapeText(opt.label)}</button>`,
      )
      .join("");
  } else {
    scopeEl.hidden = true;
    scopeEl.innerHTML = "";
  }

  listEl.innerHTML = rows.length
    ? rows.map(renderRow).join("")
    : `<p class="action-drawer__empty">Nothing needs attention here. Every objective is on track.</p>`;
}

export function init() {
  injectOnce();
}

export function open({ contextId = null } = {}) {
  injectOnce();
  requestOpen(MODAL_ID, close);

  openedFromContextId = contextId;
  scopeContextId = contextId;
  paint();

  backdrop.hidden = false;
  backdrop.classList.add("open");
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
  drawer.querySelector("[data-drawer-close]")?.focus();
}

function close() {
  if (!initialized) return;
  drawer.classList.remove("open");
  backdrop.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("has-modal");
  notifyClose(MODAL_ID);
}
