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
// grey, with the data-stagnate / data-decrease glyph.
export function renderMiniWidget(w, { style = "" } = {}) {
  const v = w.variation;
  const icon = v > 0 ? "ap-icon-data-increase" : v < 0 ? "ap-icon-data-decrease" : "ap-icon-data-stagnate";
  return `
    <div class="recap__widget recap__widget--mini" ${style ? `style="${style}"` : ""}>
      <div class="recap__overview">
        <span class="recap__overview-title">${esc(w.title)}</span>
        <div class="recap__overview-content">
          <div class="recap__overview-metric">${esc(w.value)}</div>
          <div class="recap__overview-variation ${v > 0 ? "is-positive" : ""}">
            <i class="${icon}" aria-hidden="true"></i>
            <span>${v >= 0 ? "+" : ""}${v}%</span>
          </div>
        </div>
        ${w.narrative ? `<span class="recap__overview-narrative">${esc(w.narrative)}</span>` : ""}
      </div>
    </div>`;
}
