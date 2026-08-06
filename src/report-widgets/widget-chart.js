import Highcharts from "../../vendor/highcharts/highcharts-12.4.0.esm.js";
import { barOptions, columnOptions, sharedTooltipFormatter } from "./chart-builders.js?v=1";

// The only module in this repo that touches Highcharts — the counterpart of
// widget-card-charts.component.ts, which is likewise the single place Report Studio
// instantiates a chart. Keeping it to one file is what makes the dependency
// reviewable: grep for the import and this is the only hit.
//
// A spec is `{ type, series, categories?, stacked?, legend? }`. Type picks the
// options builder; everything else is the series the caller already built.

const BUILDERS = {
  column: (spec) => columnOptions({ stacked: spec.stacked, categories: spec.categories }),
  bar: () => barOptions(),
};

// MINI drops the legend and shrinks the plot — UNSUPPORTED_CHART_TYPES_AT_MINI_SIZE
// keeps tables and heatmaps out of that size entirely, but a column chart survives it.
function applySize(options, size) {
  if (size !== "mini") return options;
  return { ...options, legend: { ...options.legend, enabled: false } };
}

export function renderChart(node, spec) {
  const build = BUILDERS[spec.type];
  if (!build) return null;

  const options = applySize(build(spec), spec.size);
  const chart = Highcharts.chart(node, {
    ...options,
    legend: { ...options.legend, ...(spec.legend === false ? { enabled: false } : {}) },
    tooltip: { ...options.tooltip, formatter: spec.tooltipFormatter || sharedTooltipFormatter() },
    series: spec.series,
  });
  return chart;
}
