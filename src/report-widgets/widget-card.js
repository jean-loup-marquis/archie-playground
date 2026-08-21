import { escapeText, escapeAttr } from "../utils.js?v=38";
import { renderOverviewCard } from "./widget-overview.js?v=18";

// Port of report/widgets/ui/components/widget-card.
//
// The frame every widget draws in, and the one entry point a screen calls. It takes
// the same single object the real component does — a WidgetData — and picks its body
// from what that object carries:
//
//   overviewData  → the KPI tile (widget-overview.js)
//   chart         → a Highcharts chart, mounted after the HTML lands in the DOM
//   bodyHtml      → the caller's own markup, for the shapes the library has no
//                   primitive for (the activity calendar)
//
// Charts cannot be built from a string: Highcharts needs a live node. So a card with
// a chart renders an empty .chart-wrapper carrying a data-widget-chart id, and the
// screen calls mountWidgetCharts(root) once its HTML is in the document.

const pendingCharts = new Map();
let chartSeq = 0;

function renderHeader(data) {
  return `
    <div class="header-wrapper">
      <div class="title-wrapper">
        <h3 class="title-wrapper__title" title="${escapeAttr(data.title)}">${escapeText(data.title)}</h3>
      </div>
    </div>`;
}

// `toolbarHtml` is an OPTION, not part of `data`: the real widget-card takes a
// WidgetData and nothing else, and its toolbar is a separate component the grid drops
// into the card's host. Keeping it out of `data` is what keeps that contract honest —
// options are this layer's own business, the way `style` and `size` already are.
//
// With a toolbar the card gains that host, for the same reason the real one has it: the
// card clips its own overflow so a chart can't spill, and a toolbar straddling the
// card's top edge would be cut in half by it. The host takes the grid placement; the
// card fills it.
export function renderWidgetCard(data, { style = "", size = "mini", toolbarHtml = "" } = {}) {
  const cardClass = `widget-card${data.className ? ` ${escapeAttr(data.className)}` : ""}`;
  const styleAttr = style ? ` style="${escapeAttr(style)}"` : "";
  const attrs = ` class="${cardClass}"` + (toolbarHtml ? "" : styleAttr);

  const inner = data.overviewData
    ? `<div${attrs}>${renderOverviewCard(data.overviewData, { size, bodyHtml: data.bodyHtml })}</div>`
    : (() => {
        let body = data.bodyHtml || "";
        if (data.chart) {
          const id = `wchart-${(chartSeq += 1)}`;
          pendingCharts.set(id, data.chart);
          body = `<div class="chart-wrapper" data-widget-chart="${id}"></div>`;
        }
        return `
    <div${attrs}>
      ${renderHeader(data)}
      ${body}
      ${data.footerHtml ? `<div class="widget-card__footer">${data.footerHtml}</div>` : ""}
    </div>`;
      })();

  if (!toolbarHtml) return inner;
  return `<div class="widget-card-host--editable"${styleAttr}>${toolbarHtml}${inner}</div>`;
}

// Called by the screen after its innerHTML assignment. Anything still queued but no
// longer in the document is dropped — a repaint that never mounted its chart must
// not leak the spec into the next one.
export async function mountWidgetCharts(root) {
  if (!pendingCharts.size) return;
  const { renderChart } = await import("./widget-chart.js?v=19");
  for (const node of root.querySelectorAll("[data-widget-chart]")) {
    const spec = pendingCharts.get(node.dataset.widgetChart);
    if (spec) renderChart(node, spec);
  }
  pendingCharts.clear();
}
