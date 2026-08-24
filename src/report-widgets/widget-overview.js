import { escapeText, escapeAttr } from "../utils.js?v=44";
import { formatCompactNumber, formatGroupedNumber, roundVariationPercent } from "./number-formatting.js?v=24";

// Port of report/widgets/ui/components/widget-card/widget-card-overview.
//
// The KPI tile: a grey title, one metric, one variation. Report Studio drives it
// from a single object and so does this — `overviewData`, the same shape as
// WidgetCardOverviewData:
//
//   { title, titleTooltip?, count?, metric?, unit?, prefix?, variationPercent?,
//     variationDisplayed?, roundedCountEnabled?, narrative? }
//
// `metric` (a string) wins over `count` (a number). That branch is what the Voice
// widgets are — a favourite tone is a KPI whose value happens to be words — and it
// is why they do not need a card of their own.
//
// `roundedCountEnabled` is opt-in, the mirror of the report's ROUNDED overviewMetric
// format: off, a count reads with grouped thousands ("18,400"); on, compact ("18.4K").
//
// Two additions, neither in the real component: `prefix`, for a figure that only
// means anything signed ("+1,240" of follower growth), and `narrative`, a second line
// carrying the ratio a cumulative figure cannot show on its own.

const SIZE_CENTERED = new Set(["small", "medium", "large"]);

// mocks.js describes a widget the way a report config does — `variation` rather than
// `variationPercent`, plus the placement fields a grid needs. This is the one place
// that difference is reconciled, so no screen carries a bespoke mapping.
export function toOverviewData(w) {
  return {
    title: w.title,
    count: w.count,
    metric: w.metric,
    unit: w.unit,
    prefix: w.prefix,
    variationPercent: w.variation,
    narrative: w.narrative,
  };
}

// Omitting `variationPercent` draws no row at all. Passing 0 is different and
// deliberate: it draws the flat glyph, which claims a comparison was actually made.
//
// The real component shows a "No data" row instead, because a report widget always
// has a period to compare against. The Usage tab states none — its figures run from
// the day the account started — so `variationDisplayed: true` is what opts a widget
// into that row.
function renderVariation(data) {
  const rounded = roundVariationPercent(data.variationPercent);
  if (rounded === null) {
    if (data.variationDisplayed !== true) return "";
    return `
      <div class="overview-card__variation">
        <i class="ap-icon-info" aria-hidden="true"></i>
        <span class="overview-card__no-data">No data</span>
      </div>`;
  }
  if (data.variationDisplayed === false) return "";

  const icon = rounded > 0 ? "data-increase" : rounded < 0 ? "data-decrease" : "data-stagnate";
  return `
    <div class="overview-card__variation ${rounded > 0 ? "overview-card__variation--positive" : ""}">
      <i class="ap-icon-${icon}" aria-hidden="true"></i>
      <span>${rounded >= 0 ? "+" : ""}${escapeText(String(rounded))}%</span>
    </div>`;
}

function renderMetric(data) {
  if (data.metric) {
    return `<span class="overview-card__metric-text">${escapeText(data.metric)}</span>`;
  }
  if (data.count === null || data.count === undefined) {
    return "<span>—</span>";
  }
  const shown = data.roundedCountEnabled ? formatCompactNumber(data.count, true) : formatGroupedNumber(data.count);
  return `<span>${escapeText(data.prefix || "")}${escapeText(String(shown))}${escapeText(data.unit || "")}</span>`;
}

// `bodyHtml` replaces the metric+variation pair for the two Usage widgets whose
// value is a shape rather than a figure — the gauge's dial, the streak's ladder.
// They keep the tile's title, gap and narrative; only the middle differs.
export function renderOverviewCard(data, { size = "mini", bodyHtml = "" } = {}) {
  const centered = SIZE_CENTERED.has(size);
  const tag = centered ? "h3" : "span";
  const classes = [centered && "overview-card__title-text", data.titleTooltip && "overview-card__title--with-tooltip"]
    .filter(Boolean)
    .join(" ");
  const titleAttrs =
    (classes ? ` class="${classes}"` : "") + (data.titleTooltip ? ` title="${escapeAttr(data.titleTooltip)}"` : "");

  const body = bodyHtml || `<div class="overview-card__metric">${renderMetric(data)}</div>${renderVariation(data)}`;

  return `
    <div class="overview-card ${centered ? "overview-card--centered" : ""}">
      <div class="overview-card__title">
        <${tag}${titleAttrs}>${escapeText(data.title)}</${tag}>
      </div>
      <div class="overview-card__content">${body}</div>
      ${data.narrative ? `<span class="overview-card__narrative">${escapeText(data.narrative)}</span>` : ""}
    </div>`;
}
