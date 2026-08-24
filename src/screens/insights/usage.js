import { escapeText } from "../../utils.js?v=40";
import { archieUsage, toneDistribution } from "../../mocks.js?v=106";
import { getContexts } from "../../contexts-store.js?v=92";
import { renderEditorialBanner } from "../../components/editorial-banner.js?v=22";
import { renderWidgetCard } from "../../report-widgets/widget-card.js?v=21";
import { renderOverviewCard, toOverviewData } from "../../report-widgets/widget-overview.js?v=20";
import { buildCategoryBarChartSeries } from "../../report-widgets/chart-builders.js?v=21";

// Insights › Usage — what Archie produced, how you work with it, and your voice.
//
// The counterpoint to Performance: nothing here compares a number to a goal. Ranges
// differ per card on purpose, and a second range is not the problem a page like this
// has — an unstated one is.
//
// Which is where this tab currently stands: the lead opens the first section and
// states "this month" for its own word count, the calendar states its own 90 days,
// and the four produced figures state nothing. See the spec's decision 5.

export function renderUsageTab() {
  const { lead, produced, work, voice } = archieUsage();

  return `
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">What Archie produced</h2>
      ${renderEditorialBanner({ lead })}
      <div class="insights-usage__produced">
        ${renderGauge(produced.keptRate)}
        ${produced.widgets.map((w) => renderWidgetCard({ overviewData: toOverviewData(w) })).join("")}
      </div>
    </section>
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">How you work</h2>
      <div class="insights-usage__work">
        ${renderBars(
          "Where you publish",
          work.networks.map((n) => ({ label: n.label, value: n.share, valueLabel: `${n.share}%` })),
          { colorByCategory: true },
        )}
        ${renderStreak(work.streak)} ${renderLongestStreak(work)} ${renderBars("The tone that recurs", toneBars())}
        ${renderCalendar(work)} ${renderWorkNote(work.calendarNote)}
      </div>
    </section>
    ${renderVoiceBlock(voice)}`;
}

// Four equal things, written as a list and rendered through one path — which is what
// stops a fifth one being pasted in with a different shape. None of them carries a
// trend, so none gets a `variation`.
//
// They are KPI tiles whose value happens to be words rather than a figure, which the
// overview card already has a branch for (`metric`) — so none of them needs a card of
// its own. Only at mini: that branch clamps to two lines, and the centred sizes set
// the metric to 64px, which no sentence survives. The opening keeps its quote marks
// in the string rather than a quote block, so all four read as one row.
function renderVoiceBlock(voice) {
  const cards = [
    { title: "Favourite tone", metric: voice.favouriteTone, narrative: `${voice.toneRunnerUp} runs a close second.` },
    {
      title: "Favourite opening",
      metric: `“${voice.favouriteHook.text}”`,
      narrative: `Used ${voice.favouriteHook.uses} times.`,
    },
    { title: "Signature word", metric: `“${voice.signatureWord}”` },
    { title: "Always avoided", metric: voice.alwaysAvoid },
  ];
  return `
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">Your voice</h2>
      <div class="insights-voice">
        ${cards.map((c) => renderWidgetCard({ overviewData: toOverviewData(c) })).join("")}
      </div>
    </section>`;
}

// A gauge expresses a part of a whole, so it is reserved for the one rate on this tab
// — putting one on a volume like "2,431 drafts" would be a visual lie.
//
// The dial stays hand-drawn rather than becoming the report's half-donut: it is the
// same annulus as the Playbook health ring, and converting one of the pair without the
// other would break the thing that makes them read as one system. So it borrows the
// card and the title from the real tile and substitutes only the middle.
function renderGauge(rate) {
  const dial = `
    <div
      class="insights-gauge__dial"
      style="--gauge-progress: ${rate}"
      role="img"
      aria-label="${rate}% of drafts kept without editing"
    >
      <span class="insights-gauge__value">${escapeText(String(rate))}%</span>
    </div>`;

  return `
    <div class="widget-card insights-gauge">
      ${renderOverviewCard(
        { title: "Kept without editing", narrative: "Of 2,431 drafts generated." },
        { bodyHtml: dial },
      )}
    </div>`;
}

// A tone shown as a single value says nothing; three tones spread over four Playbooks
// says something about the brand.
function toneBars() {
  const total = getContexts().length || 1;
  return toneDistribution().map((t) => ({
    label: t.label,
    value: (t.count / total) * 100,
    valueLabel: `${t.count} ${t.count === 1 ? "Playbook" : "Playbooks"}`,
  }));
}

// One card per group, so a reader compares bars inside a frame and not across one.
// The report's BAR chart, which is what a distribution is over there: the category
// names go on the axis, each bar takes its own palette position, and the share sits at
// the bar's end. `rows` arrives in reading order — the axis is reversed for it.
function renderBars(title, rows, { colorByCategory = false } = {}) {
  return renderWidgetCard({
    title,
    chart: { type: "bar", series: buildCategoryBarChartSeries(title, rows, { colorByCategory }) },
    className: "insights-usage__wide",
  });
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

function dayCount(n) {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

// The rungs a streak climbs, and the whole reason the badge can evolve: a raw count
// has nothing to cross. One filled star per rung passed. It stops at 60 because a
// fifth star nobody can reach is decoration, not a ladder.
const STREAK_MILESTONES = [3, 7, 14, 30, 60];

// The gamified half of the pair — a held streak is the one thing on this tab the
// reader did rather than received, so it gets the count as the figure, the ladder as
// the progress, and a next rung to aim at. Green, like the grid it is measured from,
// and because this DS reserves green for something having gone right.
function renderStreak(streak) {
  const passed = STREAK_MILESTONES.filter((m) => streak >= m).length;
  const next = STREAK_MILESTONES.find((m) => m > streak);
  // No `title` on the stars. a94d3015 took a figure out of a tooltip on this page for
  // the reason that applies here too: hover-only text is unreachable by keyboard, and
  // on an aria-hidden element it reaches nothing at all. The rungs go in the ladder's
  // own label instead, and the next one is on screen in the narrative below.
  const stars = STREAK_MILESTONES.map(
    (_, i) => `<i class="${i < passed ? "ap-icon-star_fill is-earned" : "ap-icon-star"}" aria-hidden="true"></i>`,
  ).join("");
  const ladderLabel = `${passed} of ${STREAK_MILESTONES.length} milestones reached — ${STREAK_MILESTONES.join(", ")} days`;

  const body = `
    <div class="overview-card__metric">${escapeText(dayCount(streak))}</div>
    <div class="insights-streak__ladder" role="img" aria-label="${escapeText(ladderLabel)}">
      ${stars}
    </div>`;

  return `
    <div class="widget-card">
      ${renderOverviewCard(
        {
          title: "Current streak",
          narrative: next ? `${dayCount(next - streak)} to a ${next}-day streak.` : "Past every milestone.",
        },
        { bodyHtml: body },
      )}
    </div>`;
}

// The record, and how far the current run is from it — derived rather than mocked, so
// the pair can never disagree. Without that second line the card was a title over a
// number, stretched to match the height of the one beside it.
function renderLongestStreak({ streak, longestStreak }) {
  const gap = longestStreak - streak;
  return renderWidgetCard({
    overviewData: {
      title: "Longest streak",
      metric: dayCount(longestStreak),
      narrative: gap > 0 ? `${dayCount(gap)} above your current one.` : "Your current run is your best.",
    },
  });
}

// The one widget on this tab whose CONTENT is not the library's: a 90-day
// contributions grid is not a shape Report Studio draws, so it stays hand-built. Only
// the frame is the real one — the card, its title, its height contract — which is what
// keeps it lined up with the tiles beside it rather than looking like a second design.
//
// Its own range label: 90 days is not the stretch the section above covers, and a grid
// of 90 cells states no period on its own.
function renderCalendar({ calendar, calendarLabel }) {
  const cells = calendar
    .map((level) => `<span class="insights-calendar__cell insights-calendar__cell--${level}"></span>`)
    .join("");
  const body = `
    <span class="insights-calendar__range">${escapeText(calendarLabel)}</span>
    <div class="insights-calendar__grid" role="img" aria-label="${escapeText(calendarSummary(calendar))}">
      ${cells}
    </div>
    ${renderIntensityLegend()}`;

  return renderWidgetCard({ title: "Creation activity", bodyHtml: body, className: "insights-usage__wide" });
}

// The one conclusion on this tab, and no card around it: a card frames data, and
// this is the sentence read off the grid above it. .editorial-lead is the app's
// existing treatment for exactly that — prose, no surface — so it is reused rather
// than restyled. It stays in this column, under the grid it was read from, because
// full-width it would read as a conclusion about the whole section.
function renderWorkNote(note) {
  return `
    <p class="editorial-lead insights-usage__note">
      <i class="ap-icon-quote" aria-hidden="true"></i>
      ${escapeText(note)}
    </p>`;
}
