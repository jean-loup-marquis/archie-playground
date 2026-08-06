import { escapeText, escapeAttr } from "../utils.js?v=21";
import { formatCompactNumber, formatGroupedNumber, roundVariationPercent } from "./number-formatting.js?v=1";

// Port of report/widgets/ui/components/widget-card/widget-card-overview.
//
// The KPI tile: a grey title, one metric, one variation. Report Studio drives it
// from a single object and so does this — `overviewData`, the same shape as
// WidgetCardOverviewData:
//
//   { title, titleTooltip?, count?, metric?, unit?, variationPercent?,
//     variationDisplayed?, roundedCountEnabled?, narrative? }
//
// `metric` (a string) wins over `count` (a number). That branch is what the Voice
// widgets are — a favourite tone is a KPI whose value happens to be words — and it
// is why they do not need a card of their own.
//
// `narrative` is the prototype's own addition, not in the real component: a second
// line under the variation for the ratio a cumulative figure cannot show.

const SIZE_CENTERED = new Set(["small", "medium", "large"]);

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
  const rounded = data.roundedCountEnabled !== false;
  const shown = rounded ? formatCompactNumber(data.count, true) : formatGroupedNumber(data.count);
  return `<span>${escapeText(String(shown))}${escapeText(data.unit || "")}</span>`;
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
      <div class="overview-card__content">
        ${body}
        ${data.narrative ? `<span class="overview-card__narrative">${escapeText(data.narrative)}</span>` : ""}
      </div>
    </div>`;
}
