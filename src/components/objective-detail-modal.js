// The objective detail modal (handoff 6a) — the board's reading surface. It
// opens OVER the board (blurred backdrop, the board stays legible-but-quiet),
// carries the ↑↓ navigation through the board's own order plus ✕, and renders
// exactly the shared objective-detail component the List view shows in place —
// the modal only exists from the board; in List, nothing opens.
//
// Motion: a 240ms ease-out scale-in (brand: no bounce). The handoff asks for a
// FLIP stretch from the card's position — documented deviation, the plain
// scale-in keeps the timing contract without per-card geometry.

import { requestOpen, notifyClose } from "../modal-coordinator.js?v=35";
import { renderObjectiveDetail } from "../screens/insights/objective-detail.js?v=2";

const MODAL_ID = "objectiveDetail";

let backdrop = null;
let panel = null;
let bodyEl = null;
let initialized = false;

let entries = [];
let index = 0;
let expandedId = null;
let onAdjustCb = null;

const SHELL = `
<div class="app-modal-backdrop blurred objdm__backdrop" id="objdmBackdrop" hidden>
  <aside class="ap-dialog objdm" id="objdmModal" role="dialog" aria-modal="true" aria-label="Objective detail" tabindex="-1">
    <div class="objdm__controls">
      <button type="button" class="ap-icon-button stroked grey" data-objdm-prev aria-label="Previous objective"><i class="ap-icon-chevron-up"></i></button>
      <button type="button" class="ap-icon-button stroked grey" data-objdm-next aria-label="Next objective"><i class="ap-icon-chevron-down"></i></button>
      <button type="button" class="ap-icon-button stroked grey" data-objdm-close aria-label="Close"><i class="ap-icon-close"></i></button>
    </div>
    <div class="ap-dialog-content objdm__content"></div>
  </aside>
</div>`;

export function init() {
  if (initialized) return;
  const host = document.createElement("div");
  host.innerHTML = SHELL;
  while (host.firstChild) document.body.appendChild(host.firstChild);
  backdrop = document.getElementById("objdmBackdrop");
  panel = document.getElementById("objdmModal");
  bodyEl = panel.querySelector(".objdm__content");

  panel.addEventListener("click", onClick);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", (e) => {
    if (!backdrop || backdrop.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowUp") step(-1);
    if (e.key === "ArrowDown") step(1);
  });
  window.addEventListener("hashchange", close);
  initialized = true;
}

export function open(opts) {
  init();
  requestOpen(MODAL_ID, close);
  entries = opts.entries || [];
  index = Math.max(0, Math.min(entries.length - 1, opts.index || 0));
  onAdjustCb = opts.onAdjust || null;
  expandedId = null;
  paint();
  backdrop.hidden = false;
  panel.classList.remove("objdm--in");
  // Force a frame so the scale-in transition runs from its initial state.
  window.requestAnimationFrame(() => panel.classList.add("objdm--in"));
  panel.focus?.();
}

export function close() {
  if (!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  panel.classList.remove("objdm--in");
  bodyEl.innerHTML = "";
  entries = [];
  onAdjustCb = null;
  notifyClose(MODAL_ID);
}

function step(delta) {
  if (!entries.length) return;
  index = (index + delta + entries.length) % entries.length;
  expandedId = null;
  paint();
}

function paint() {
  const entry = entries[index];
  if (!entry) {
    close();
    return;
  }
  bodyEl.innerHTML = renderObjectiveDetail(entry, {
    expandedId,
    host: "modal",
  });
}

function onClick(event) {
  if (event.target.closest("[data-objdm-close]")) {
    close();
    return;
  }
  if (event.target.closest("[data-objdm-prev]")) {
    step(-1);
    return;
  }
  if (event.target.closest("[data-objdm-next]")) {
    step(1);
    return;
  }
  const toggle = event.target.closest("[data-objd-measure-toggle]");
  if (toggle) {
    // Clicking the open measure folds it — "none" collapses everything,
    // where null would fall back to the weakest-measure default.
    expandedId = toggle.getAttribute("aria-expanded") === "true" ? "none" : toggle.dataset.objdMeasureToggle;
    paint();
    return;
  }
  if (event.target.closest("[data-objd-adjust]")) {
    const entry = entries[index];
    const cb = onAdjustCb;
    close();
    cb?.(entry);
    return;
  }
  if (event.target.closest("[data-objd-ga]")) {
    import("./toast.js?v=44").then(({ showToast }) => showToast("Google Analytics isn't wired up in this prototype"));
  }
}
