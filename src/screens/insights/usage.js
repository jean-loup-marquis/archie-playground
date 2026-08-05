import { escapeText } from "../../utils.js?v=21";
import { archieUsage, toneDistribution } from "../../mocks.js?v=74";
import { getContexts } from "../../contexts-store.js?v=48";
import { renderEditorialBanner } from "../../components/editorial-banner.js?v=2";
import { renderMiniWidget } from "../../components/report-widget.js?v=3";

// Insights › Usage — what Archie produced, and how you work with it.
//
// The counterpoint to Performance: nothing here compares a number to a goal. Ranges
// differ per card on purpose and each one says so — a bare number is what is
// forbidden, not a second range.

export function renderUsageTab() {
  const { lead, produced, work } = archieUsage();

  return `
    <p class="insights-tab__period">Last 30 days</p>
    ${renderEditorialBanner({ lead })}
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">What Archie produced</h2>
      <div class="insights-usage__produced">
        ${renderGauge(produced.keptRate)}
        ${produced.widgets.map((w) => renderMiniWidget(w)).join("")}
      </div>
    </section>
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">How you work</h2>
      <div class="insights-usage__work">
        <div class="recap__widget">
          ${renderBars(
            "Where you publish",
            work.networks.map((n) => ({ value: n.share, caption: `${n.label} · ${n.share}%` })),
          )}
          ${renderBars("The tone that recurs", toneBars())}
        </div>
        ${renderCalendar(work)}
      </div>
    </section>`;
}

// A gauge expresses a part of a whole, so it is reserved for the one rate on this tab
// — putting one on a volume like "2,431 drafts" would be a visual lie. Same annulus
// as the Playbook health ring, so the two read as one system.
function renderGauge(rate) {
  return `
    <div class="recap__widget recap__widget--mini insights-gauge">
      <span class="recap__overview-title">Kept without editing</span>
      <div
        class="insights-gauge__dial"
        style="--gauge-progress: ${rate}"
        role="img"
        aria-label="${rate}% of drafts kept without editing"
      >
        <span class="insights-gauge__value">${escapeText(String(rate))}%</span>
      </div>
      <span class="recap__overview-narrative">Of 2,431 drafts generated.</span>
    </div>`;
}

// A tone shown as a single value says nothing; three tones spread over four Playbooks
// says something about the brand.
function toneBars() {
  const total = getContexts().length || 1;
  return toneDistribution().map((t) => ({
    value: (t.count / total) * 100,
    caption: `${t.label} · ${t.count} ${t.count === 1 ? "Playbook" : "Playbooks"}`,
  }));
}

function renderBars(title, rows) {
  const bars = rows
    .map(
      (r) => `
      <div class="insights-bars__row">
        <div class="insights-bars__bar" style="width: ${Math.max(4, Math.round(r.value))}%"></div>
        <span class="insights-bars__caption">${escapeText(r.caption)}</span>
      </div>`,
    )
    .join("");
  return `
    <div class="insights-bars">
      <h3 class="insights-bars__title">${escapeText(title)}</h3>
      ${bars}
    </div>`;
}

const INTENSITY_LABELS = ["no activity", "light", "moderate", "heavy"];

// Four shades of one hue cannot separate by 3:1 per step — the palette's whole
// green ramp spans 4.19:1, so three steps give ~1.6:1 at best. The shades carry
// the pattern; the legend and this sentence carry the meaning.
function calendarSummary(calendar) {
  const counts = INTENSITY_LABELS.map((_, level) => calendar.filter((v) => v === level).length);
  const parts = counts.map((n, level) => `${n} ${INTENSITY_LABELS[level]}`);
  return `Creation activity over ${calendar.length} days: ${parts.join(", ")}.`;
}

// A shade scale is unreadable without a key — the grid says "more here than
// there", never how much. Ends labelled rather than every step: the middle two
// are read by position between them.
function renderIntensityLegend() {
  const swatches = INTENSITY_LABELS.map(
    (_, level) => `<span class="insights-calendar__cell insights-calendar__cell--${level}" aria-hidden="true"></span>`,
  ).join("");
  return `
    <div class="insights-calendar__legend">
      <span class="insights-calendar__legend-label">Less</span>
      ${swatches}
      <span class="insights-calendar__legend-label">More</span>
    </div>`;
}

// Its own range label, so it does not contradict the tab's 30-day header.
function renderCalendar({ calendar, calendarLabel, calendarNote, streak, longestStreak }) {
  const cells = calendar
    .map((level) => `<span class="insights-calendar__cell insights-calendar__cell--${level}"></span>`)
    .join("");
  return `
    <div class="recap__widget">
      <div class="insights-calendar__head">
        <h3 class="insights-bars__title">${streak}-day streak</h3>
        <span class="ap-status grey no-dot">Longest: ${longestStreak} days</span>
      </div>
      <span class="insights-calendar__range">${escapeText(calendarLabel)}</span>
      <div class="insights-calendar__grid" role="img" aria-label="${escapeText(calendarSummary(calendar))}">
        ${cells}
      </div>
      ${renderIntensityLegend()}
      <span class="recap__overview-narrative">${escapeText(calendarNote)}</span>
    </div>`;
}
