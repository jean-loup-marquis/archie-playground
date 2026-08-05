import { escapeHtml as esc } from "../utils.js?v=21";

// A Report Studio widget card, mini size — the S "overview" variant: a 14px grey
// title over the metric at font-size-xl bold, then the variation.
//
// Extracted from playbook-view so the Analytics hub renders the SAME card as a
// Playbook's Performance section rather than a lookalike. It deliberately keeps
// the `recap__*` class names: the styles live in styles/screens/welcome.css
// (transcribed from widget-card.component.scss + widget-card-overview) and
// re-namespacing them would mean duplicating the CSS, which is how two surfaces
// start drifting apart.
//
// Placement is the caller's business — the Playbook report spells out explicit
// cells on a 9-column grid, the hub just puts three in a row — so `style` is
// passed in rather than computed here.

// The variation only goes green when it's positive; flat and negative both stay
// grey, with the data-stagnate / data-decrease glyph. A widget that omits
// `variation` gets no row at all — passing 0 instead would draw the flat-trend
// arrow, which claims a measurement nobody took.
// `quote: true` marks a value that is a verbatim snippet of the user's own writing
// rather than a figure. It swaps the XL bold metric for .recap__quote — the block a
// Playbook's Voice section already uses for signature hooks — because XL bold reads
// as a headline, and a hook is being shown, not announced. A one-item <ul>: the <li>
// carries the look, the list carries list-style and the gap.
export function renderMiniWidget(w, { style = "" } = {}) {
  const v = w.variation;
  const hasVariation = typeof v === "number";
  const icon = v > 0 ? "ap-icon-data-increase" : v < 0 ? "ap-icon-data-decrease" : "ap-icon-data-stagnate";
  const value = w.quote
    ? `<ul class="recap__quotes">
            <li class="recap__quote"><i class="ap-icon-quote" aria-hidden="true"></i><span>${esc(w.value)}</span></li>
          </ul>`
    : `<div class="recap__overview-metric">${esc(w.value)}</div>`;
  return `
    <div class="recap__widget recap__widget--mini" ${style ? `style="${style}"` : ""}>
      <div class="recap__overview">
        <span class="recap__overview-title">${esc(w.title)}</span>
        <div class="recap__overview-content">
          ${value}
          ${
            hasVariation
              ? `<div class="recap__overview-variation ${v > 0 ? "is-positive" : ""}">
            <i class="${icon}" aria-hidden="true"></i>
            <span>${v >= 0 ? "+" : ""}${v}%</span>
          </div>`
              : ""
          }
        </div>
        ${w.narrative ? `<span class="recap__overview-narrative">${esc(w.narrative)}</span>` : ""}
      </div>
    </div>`;
}
