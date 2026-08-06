// Ports of report/widgets/utils/widget-data-helpers/formatting/number-formatting.helpers.ts.
//
// Kept as exact ports rather than "close enough" rewrites: these two decide what
// digit a reader sees in a KPI tile, so a rounding rule that drifts from Report
// Studio's makes the same metric read differently in the two products.

const LOCALE = "en-US";

// Below 1000 the raw count is returned untouched — compact notation on "847"
// would render "847" anyway, and Intl would drop a decimal the tile wants.
export function formatCompactNumber(count, roundedCountEnabled = true) {
  if (!roundedCountEnabled || Math.abs(count) < 1000) return count;
  const magnitude = Math.floor(Math.log10(Math.abs(count)) / 3);
  const scaledValue = Math.abs(count) / 1000 ** magnitude;
  return new Intl.NumberFormat(LOCALE, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: scaledValue >= 10 ? 0 : 1,
  }).format(count);
}

// Grouped thousands, the tile's format below the compact threshold.
export function formatGroupedNumber(count) {
  return new Intl.NumberFormat(LOCALE).format(count);
}

export function roundVariationPercent(value) {
  return value !== undefined && value !== null ? Math.round(value * 10) / 10 : null;
}
