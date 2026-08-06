import { escapeText, escapeAttr } from "../utils.js?v=21";
import { renderOverviewCard } from "./widget-overview.js?v=1";

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

export function renderWidgetCard(data, { style = "", size = "mini" } = {}) {
  const attrs =
    ` class="widget-card${data.className ? ` ${escapeAttr(data.className)}` : ""}"` +
    (style ? ` style="${escapeAttr(style)}"` : "");

  if (data.overviewData) {
    return `<div${attrs}>${renderOverviewCard(data.overviewData, { size, bodyHtml: data.bodyHtml })}</div>`;
  }

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
}

// Called by the screen after its innerHTML assignment. Anything still queued but no
// longer in the document is dropped — a repaint that never mounted its chart must
// not leak the spec into the next one.
export async function mountWidgetCharts(root) {
  if (!pendingCharts.size) return;
  const { renderChart } = await import("./widget-chart.js?v=1");
  for (const node of root.querySelectorAll("[data-widget-chart]")) {
    const spec = pendingCharts.get(node.dataset.widgetChart);
    if (spec) renderChart(node, spec);
  }
  pendingCharts.clear();
}
