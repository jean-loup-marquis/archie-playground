// The DS tooltip, driven from vanilla JS.
//
//   <i class="ap-icon-info" data-tooltip="…"></i>
//
// `.ap-tooltip` ships the whole look — surface, radius, type, the arrow and its
// eight placement classes — but no way to show itself: in the DS it is positioned
// by an Angular directive, and CSS-UI has no hover trigger. This is that directive,
// in the ~90 lines it takes here.
//
// It mounts on <body>, NOT beside the anchor, and that is the entire point. The
// class is `position: absolute`, so rendered in place it would be clipped by the
// nearest scroll container — and the surface that wants tooltips most, the Image
// Studio settings panel, is an `overflow-y: auto` box. `position: fixed` doesn't
// save it either: the panel is `transform`ed, which makes it the containing block
// for fixed descendants and hands the clipping straight back. From <body> there is
// nothing between the tooltip and the viewport.
//
// One tooltip at a time, and it never outlives its anchor: any scroll, any Esc, any
// pointer or focus leaving the anchor takes it down. A tooltip that survives the
// thing it points at is worse than no tooltip.

const ANCHOR_SEL = "[data-tooltip]";
const GAP = 8; // between the anchor and the tooltip's edge
const EDGE = 8; // smallest gap the tooltip keeps from the viewport
const ARROW_HALF = 8; // .ap-tooltip's --ap-arrow-width is 16px

let initialized = false;
let el = null;
let anchor = null;

export function init() {
  if (initialized) return;
  initialized = true;

  // Delegated on the document, so anything rendered later — every screen here
  // re-renders its own DOM — gets tooltips without registering anything.
  document.addEventListener("mouseover", onOver);
  document.addEventListener("mouseout", onOut);
  // Keyboard: the anchor is usually decorative (an icon inside a button, where a
  // focusable element of its own would be a control inside a control), so the
  // trigger is focus landing on anything that CONTAINS one.
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", hide);
  // Capture, because the scroll that matters is a panel's, not the page's — and
  // scroll events don't bubble.
  document.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  document.addEventListener("keydown", onKeyDown);
}

function onOver(event) {
  const next = event.target.closest?.(ANCHOR_SEL);
  if (next && next !== anchor) show(next);
}

function onOut(event) {
  if (!anchor || event.target.closest?.(ANCHOR_SEL) !== anchor) return;
  // Moving between an anchor's own children fires mouseout too; only a pointer
  // that has actually left the anchor should take the tooltip down.
  if (anchor.contains(event.relatedTarget)) return;
  hide();
}

function onFocusIn(event) {
  const host = event.target.closest?.("*");
  const next = host?.matches(ANCHOR_SEL) ? host : host?.querySelector(ANCHOR_SEL);
  if (next) show(next);
  else hide();
}

function onKeyDown(event) {
  if (event.key === "Escape") hide();
}

function show(next) {
  const text = (next.dataset.tooltip || "").trim();
  if (!text) return;
  hide();
  anchor = next;
  el = document.createElement("div");
  el.className = "ap-tooltip top";
  el.setAttribute("role", "tooltip");
  el.textContent = text; // text, never markup — a tooltip has nothing to mark up
  document.body.appendChild(el);
  place();
}

export function hide() {
  if (el) el.remove();
  el = null;
  anchor = null;
}

// Above the anchor by default, flipped below when there isn't room, and clamped
// to the viewport — with the arrow kept ON the anchor when the clamp moves the
// box, which is what the `-left` / `-right` placement variants are for.
function place() {
  const a = anchor.getBoundingClientRect();
  const t = el.getBoundingClientRect();

  let side = "top";
  let top = a.top - t.height - GAP;
  if (top < EDGE) {
    side = "bottom";
    top = a.bottom + GAP;
  }

  const centre = a.left + a.width / 2;
  const wanted = centre - t.width / 2;
  const left = Math.min(Math.max(wanted, EDGE), Math.max(EDGE, window.innerWidth - t.width - EDGE));

  if (Math.abs(left - wanted) > 0.5) {
    // Pushed right → the anchor is left of the box's centre, so the arrow is
    // measured from the left edge, and vice versa.
    const fromLeft = left > wanted;
    side += fromLeft ? "-left" : "-right";
    const offset = fromLeft ? centre - left : left + t.width - centre;
    el.style.setProperty("--ap-arrow-offset", `${Math.round(offset - ARROW_HALF)}px`);
  }

  el.className = `ap-tooltip ${side}`;
  el.style.top = `${Math.round(top + window.scrollY)}px`;
  el.style.left = `${Math.round(left + window.scrollX)}px`;
}
