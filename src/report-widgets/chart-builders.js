import { colorByName, getDataColor, greyColor } from "./report-colors.js?v=1";
import { formatGroupedNumber } from "./number-formatting.js?v=1";

// Port of report/widgets/utils/widget-data-helpers/chart/chart.builders.ts, plus the
// slice of @agorapulse/ui-charts' ChartOptions that shapes the result — the wrappers
// there are Angular components, so their options had to come across by hand.

// ChartOptions.DEFAULT_OPTIONS. Only the parts that survive without the zooming and
// export chrome a report page carries and a prototype has no use for.
function defaultOptions() {
  const grey = { 10: greyColor(10), 20: greyColor(20), 60: greyColor(60), 85: greyColor(85), 100: greyColor(100) };
  return {
    chart: { spacingRight: 20, style: { fontFamily: "var(--ref-font-family), Averta, sans-serif" } },
    credits: { enabled: false },
    title: { text: undefined },
    // A profile name runs to forty characters, so it is truncated rather than allowed
    // to claim a whole row: capping itemStyle.width lets several fit per line, and
    // maxHeight caps the legend at two of them so it cannot eat the plot. What does
    // not fit goes behind Highcharts' own pager — a real one, which paginates.
    legend: {
      borderWidth: 0,
      symbolHeight: 10,
      align: "left",
      maxHeight: 46,
      itemStyle: {
        color: grey[60],
        fontSize: "14px",
        fontWeight: "normal",
        width: 170,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      },
      itemHoverStyle: { color: grey[100], fontWeight: "bold" },
      navigation: { activeColor: grey[100], inactiveColor: grey[20], style: { color: grey[60], fontSize: "12px" } },
    },
    plotOptions: {
      series: { states: { hover: { brightness: 0 }, inactive: { enabled: true, opacity: 0.2 } }, connectNulls: true },
    },
    tooltip: {
      backgroundColor: "#FFFFFF",
      borderRadius: 4,
      borderWidth: 0,
      shadow: { color: "#000000", offsetX: 0, offsetY: 2, opacity: 0.02, width: 6 },
      split: false,
      shared: true,
      useHTML: true,
    },
    xAxis: {
      gridLineColor: grey[10],
      lineColor: grey[10],
      tickColor: grey[10],
      gridLineWidth: 1,
      title: { text: null },
      labels: { style: { color: grey[85], fontSize: "12px" } },
    },
    yAxis: {
      allowDecimals: false,
      gridLineColor: grey[10],
      lineColor: grey[10],
      gridLineWidth: 1,
      title: { text: undefined },
      labels: { style: { color: grey[85], fontSize: "12px" } },
    },
  };
}

// ChartColumnOptions.buildColumn. `scope: 'stack'` rounds only the top of the whole
// stack — the middle segments stay square, which is the detail the hand-written SVG
// needed a bespoke path function to fake.
export function columnOptions({ stacked = false, categories } = {}) {
  const base = defaultOptions();
  return {
    ...base,
    chart: { ...base.chart, type: "column" },
    // Every 4th label, horizontal. 30 days cannot all be written across one card, and
    // the report thins them rather than tilting them — a tilted date axis in a 470px
    // card costs more height than the labels are worth.
    xAxis: {
      ...base.xAxis,
      type: "category",
      categories,
      minTickInterval: 1,
      labels: { ...base.xAxis.labels, rotation: 0, step: 4 },
    },
    plotOptions: {
      ...base.plotOptions,
      column: {
        borderWidth: 0,
        crisp: false,
        maxPointWidth: 20,
        borderRadius: stacked ? { radius: "50%", scope: "stack", where: "end" } : "50%",
        ...(stacked ? { stacking: "normal" } : {}),
      },
    },
  };
}

// ChartBarOptions.buildBars — horizontal, one bar per category, no grid.
//
// `reversed` is the one departure: buildBars leaves it false, which puts the first
// category at the BOTTOM, and lets each widget's data arrive pre-sorted. Callers here
// pass rows in the order they should read top-down, so the axis is flipped instead.
//
// No `categories`: the points carry their own `name` under `type: 'category'`, and
// declaring both makes Highcharts index one against the other.
export function barOptions() {
  const base = defaultOptions();
  return {
    ...base,
    chart: { ...base.chart, type: "bar" },
    legend: { ...base.legend, enabled: false },
    xAxis: {
      ...base.xAxis,
      type: "category",
      gridLineWidth: 0,
      lineWidth: 0,
      tickWidth: 0,
      reversed: true,
      labels: { ...base.xAxis.labels, align: "right" },
    },
    // maxPadding buys the room the value label needs: with the axis hidden the plot
    // ends at the longest bar's tip, and Highcharts flips a label that does not fit to
    // the inside of the bar, where a light label on a saturated fill is unreadable.
    yAxis: { ...base.yAxis, type: "linear", minTickInterval: 1, visible: false, endOnTick: false, maxPadding: 0.25 },
    plotOptions: {
      ...base.plotOptions,
      bar: {
        maxPointWidth: 20,
        borderRadius: "50%",
        dataLabels: {
          enabled: true,
          style: { fontSize: "12px", fontWeight: "normal", color: greyColor(100), textOutline: "none" },
          formatter() {
            return this.point.options.custom?.valueLabel ?? formatGroupedNumber(this.y);
          },
        },
      },
      series: { ...base.plotOptions.series, borderWidth: 0 },
    },
  };
}

// buildColumnChartSeries. `metric.color` wins over the positional palette so a
// per-network colour survives series filtering; an empty series is `visible: false`,
// which greys it out in the legend rather than hiding that it exists.
export function buildColumnChartSeries(seriesData) {
  return seriesData.map((metric, index) => ({
    type: "column",
    name: metric.name,
    data: metric.data,
    color: metric.color ? colorByName(metric.color, index) : getDataColor(index),
    visible: metric.data.some((v) => v > 0),
  }));
}

// buildCategoryBarChartSeries — one series, one bar per category.
//
// `colorByPoint` is opt-in, mirroring buildBars' optional `pointColors`: a bar takes
// its own palette position only when the colour MEANS something elsewhere — a network,
// a profile, something the reader will meet again in another chart. For categories that
// exist only here the axis label is the identity, and six hues would be decoration.
//
// `valueLabel` is what sits at the end of the bar; the category's name is the axis
// label, so repeating it there would print it twice.
export function buildCategoryBarChartSeries(name, rows, { colorByCategory = false } = {}) {
  return [
    {
      type: "bar",
      name,
      colorByPoint: colorByCategory,
      color: getDataColor(0),
      data: rows.map((row, index) => ({
        name: row.label,
        y: row.value,
        ...(colorByCategory ? { color: getDataColor(index) } : {}),
        custom: { valueLabel: row.valueLabel },
      })),
    },
  ];
}

// buildCustomLineTooltip's renderTooltipHeader / renderTooltipRow, as a formatter.
// Highcharts skips a series with no point at the hovered x; listing every one and
// rendering the gap as "-" is the whole reason this is not the default tooltip.
export function sharedTooltipFormatter() {
  const grey = { 10: greyColor(10), 60: greyColor(60), 100: greyColor(100) };
  return function formatter() {
    const points = this.points ?? [];
    const header =
      `<div style="border-bottom: 1px solid ${grey[10]}; padding: 0 8px 7px">` +
      `<div style="white-space: wrap; font-size: 12px; color: ${grey[60]}">${this.key ?? ""}</div></div>`;
    const rows = points
      .map((point) => {
        const value = point.y === null || point.y === undefined ? "-" : formatGroupedNumber(point.y);
        return (
          `<div style="font-size: 14px; color: ${grey[100]}; margin: 6px 8px 0 8px;">` +
          `<span style="color:${point.color}">●</span> ${point.series.name}: <b>${value}</b></div>`
        );
      })
      .join("");
    return header + rows;
  };
}
