// The chart palette, read off the CSS custom properties rather than duplicated here.
//
// Port of ChartColors.DATA_COLORS / GREY_COLORS from @agorapulse/ui-charts — an
// Angular package this repo cannot import, so the values live in styles/tokens.css
// as --app-chart-* and this module hands them to Highcharts, which needs real
// strings in its options object and cannot resolve a var().
//
// Order is the contract: the categorical palette is assigned BY POSITION (1st
// series → position 0), which is what keeps a network's colour stable across the
// report, the PDF and this prototype. Wraps modulo 10, exactly as ui-charts does.

const DATA_TOKENS = [
  "--app-chart-cyan",
  "--app-chart-sun",
  "--app-chart-peony",
  "--app-chart-lime",
  "--app-chart-iris",
  "--app-chart-cherry",
  "--app-chart-sky",
  "--app-chart-tangerine",
  "--app-chart-emerald",
  "--app-chart-navy",
];

// ChartColors.GREY_COLORS — the chart chrome (grid lines, axis labels, tooltip).
// 85 maps to grey-80: the ramp's step was renamed between ui-theme 20.x (this
// repo) and 22.x (ui-charts), but both resolve to #5D6A82.
const GREY_TOKENS = {
  10: "--ref-color-grey-10",
  20: "--ref-color-grey-20",
  60: "--ref-color-grey-60",
  85: "--ref-color-grey-80",
  100: "--ref-color-grey-100",
};

let cache = null;

function readTokens() {
  if (cache) return cache;
  const style = getComputedStyle(document.documentElement);
  const read = (token) => style.getPropertyValue(token).trim();
  cache = {
    data: DATA_TOKENS.map(read),
    grey: Object.fromEntries(Object.entries(GREY_TOKENS).map(([k, token]) => [k, read(token)])),
  };
  return cache;
}

export function getDataColor(position) {
  const palette = readTokens().data;
  return palette[((position % palette.length) + palette.length) % palette.length];
}

export function getDataColors(count) {
  return Array.from({ length: Math.max(count, 0) }, (_, index) => getDataColor(index));
}

export function greyColor(step) {
  return readTokens().grey[step];
}

// The named colours mocks.js assigns per series, mapped to their palette position
// so a mock can keep saying "peony" while Highcharts gets the hex it needs.
const NAME_TO_POSITION = {
  cyan: 0,
  sun: 1,
  peony: 2,
  lime: 3,
  iris: 4,
  cherry: 5,
  sky: 6,
  tangerine: 7,
  emerald: 8,
  navy: 9,
};

export function colorByName(name, fallbackPosition = 0) {
  const position = NAME_TO_POSITION[name];
  return getDataColor(position === undefined ? fallbackPosition : position);
}
