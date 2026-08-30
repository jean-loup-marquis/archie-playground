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
import { renderObjectiveDetail } from "../screens/insights/objective-detail.js?v=9";
import { openObjectiveInChat } from "../objective-flow.js?v=1";

const MODAL_ID = "objectiveDetail";

let backdrop = null;
let panel = null;
let bodyEl = null;
let initialized = false;

let entries = [];
let index = 0;
let expandedId = null;
let historyOpen = false;
let historyFilter = "all";
let onAdjustCb = null;

const SHELL = `
<div class="app-modal-backdrop blurred objdm__backdrop" id="objdmBackdrop" hidden>
  <aside class="ap-dialog objdm" id="objdmModal" role="dialog" aria-modal="true" aria-label="Objective detail" tabindex="-1">
    <div class="objdm__controls">
      <span class="objdm__pos" aria-live="polite"></span>
      <button type="button" class="ap-icon-button stroked grey" data-objdm-prev aria-label="Previous objective"><i class="ap-icon-chevron-up"></i></button>
      <button type="button" class="ap-icon-button stroked grey" data-objdm-next aria-label="Next objective"><i class="ap-icon-chevron-down"></i></button>
      <button type="button" class="ap-icon-button stroked grey" data-objdm-close aria-label="Close"><i class="ap-icon-close"></i></button>
    </div>
    <div class="ap-dialog-content objdm__content" tabindex="0"></div>
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
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "Tab") {
      trapTab(e);
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    // Arrows read first, navigate second: while the content can still scroll
    // in that direction the key scrolls it (the content div holds focus), and
    // only at the boundary does the same key move to the next objective —
    // both at once threw away the reading position mid-scroll.
    const atTop = bodyEl.scrollTop <= 0;
    const atBottom = bodyEl.scrollTop + bodyEl.clientHeight >= bodyEl.scrollHeight - 1;
    if (e.key === "ArrowUp" && atTop) {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowDown" && atBottom) {
      e.preventDefault();
      step(1);
    }
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
  historyOpen = false;
  historyFilter = "all";
  paint();
  backdrop.hidden = false;
  panel.classList.remove("objdm--in");
  // Force a frame so the scale-in transition runs from its initial state.
  window.requestAnimationFrame(() => panel.classList.add("objdm--in"));
  // The content holds focus so arrow keys scroll the reading natively.
  bodyEl.focus?.();
}

// Tab stays inside the dialog while it is open — the board behind is blurred
// but its buttons were still one Tab away.
function trapTab(e) {
  const focusables = panel.querySelectorAll("button, a[href], [tabindex='0']");
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (!panel.contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
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
  historyOpen = false;
  historyFilter = "all";
  paint();
  bodyEl.scrollTop = 0;
}

function paint() {
  const entry = entries[index];
  if (!entry) {
    close();
    return;
  }
  const pos = panel.querySelector(".objdm__pos");
  if (pos) pos.textContent = entries.length > 1 ? `${index + 1} / ${entries.length}` : "";
  bodyEl.innerHTML = renderObjectiveDetail(entry, {
    expandedId,
    host: "modal",
    historyView: historyOpen,
    historyFilter,
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
  // View history (1e) — the body swaps, the modal chrome stays.
  if (event.target.closest("[data-objd-history]")) {
    historyOpen = true;
    historyFilter = "all";
    paint();
    bodyEl.scrollTop = 0;
    return;
  }
  if (event.target.closest("[data-objd-history-back]")) {
    historyOpen = false;
    paint();
    return;
  }
  const histFilter = event.target.closest("[data-objd-history-filter]");
  if (histFilter) {
    historyFilter = histFilter.dataset.objdHistoryFilter;
    paint();
    return;
  }
  // A feed topic's / history move's door — close, then open the pre-loaded chat.
  if (event.target.closest("[data-objd-feed-chat]")) {
    event.preventDefault();
    const entry = entries[index];
    close();
    if (entry) openObjectiveInChat(entry);
    return;
  }
  if (event.target.closest("[data-objd-repurpose]")) {
    import("./toast.js?v=44").then(({ showToast }) => showToast("Repurpose isn't wired up in this prototype"));
    return;
  }
  if (event.target.closest("[data-objd-adjust]")) {
    const entry = entries[index];
    const cb = onAdjustCb;
    close();
    cb?.(entry);
    return;
  }
  // The Next move's door — close, then open the pre-loaded chat (the
  // navigation would close the modal anyway; doing it first keeps the
  // coordinator's books straight).
  if (event.target.closest("[data-objd-next-chat]")) {
    const entry = entries[index];
    close();
    if (entry) openObjectiveInChat(entry);
    return;
  }
  if (event.target.closest("[data-objd-ga]")) {
    import("./toast.js?v=44").then(({ showToast }) => showToast("Google Analytics isn't wired up in this prototype"));
  }
}
