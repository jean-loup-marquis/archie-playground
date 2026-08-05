import { escapeText } from "../../utils.js?v=21";
import { archieUsage, toneDistribution } from "../../mocks.js?v=80";
import { getContexts } from "../../contexts-store.js?v=53";
import { renderEditorialBanner } from "../../components/editorial-banner.js?v=3";
import { renderMiniWidget } from "../../components/report-widget.js?v=5";

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
        ${produced.widgets.map((w) => renderMiniWidget(w)).join("")}
      </div>
    </section>
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">How you work</h2>
      <div class="insights-usage__work">
        <div class="insights-usage__col">
          ${renderBars(
            "Where you publish",
            work.networks.map((n) => ({ value: n.share, caption: `${n.label} · ${n.share}%` })),
          )}
          ${renderBars("The tone that recurs", toneBars())}
        </div>
        <div class="insights-usage__col">
          <div class="insights-usage__streaks">
            ${renderStreak(work.streak)}
            ${renderMiniWidget({ title: "Longest streak", value: dayCount(work.longestStreak) })}
          </div>
          ${renderCalendar(work)}
          ${renderWorkNote(work.calendarNote)}
        </div>
      </div>
    </section>
    ${renderVoiceBlock(voice)}`;
}

// Four equal things, written as a list and rendered through one path — which is what
// stops a fifth one being pasted in with a different shape. None of them carries a
// trend, so none gets a `variation`; the opening carries `quote` because a hook is a
// snippet of writing, not a figure.
function renderVoiceBlock(voice) {
  const cards = [
    { title: "Favourite tone", value: voice.favouriteTone, narrative: `${voice.toneRunnerUp} runs a close second.` },
    {
      title: "Favourite opening",
      value: voice.favouriteHook.text,
      quote: true,
      narrative: `Used ${voice.favouriteHook.uses} times.`,
    },
    { title: "Signature word", value: `“${voice.signatureWord}”` },
    { title: "Always avoided", value: voice.alwaysAvoid },
  ];
  return `
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">Your voice</h2>
      <div class="insights-voice">${cards.map((c) => renderMiniWidget(c)).join("")}</div>
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

// One card per group, so a reader compares bars inside a frame and not across one.
// `.insights-bars` carries no rule of its own any more but stays: it is the block
// child that keeps the title's and rows' margins from compounding with the card's
// own flex `gap`.
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
    <div class="recap__widget">
      <div class="insights-bars">
        <h3 class="insights-bars__title">${escapeText(title)}</h3>
        ${bars}
      </div>
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
  const stars = STREAK_MILESTONES.map(
    (m, i) =>
      `<i class="${i < passed ? "ap-icon-star_fill is-earned" : "ap-icon-star"}" aria-hidden="true" title="${m} days"></i>`,
  ).join("");

  return `
    <div class="recap__widget recap__widget--mini">
      <div class="recap__overview">
        <span class="recap__overview-title">Current streak</span>
        <div class="recap__overview-content">
          <div class="recap__overview-metric">${escapeText(dayCount(streak))}</div>
          <div
            class="insights-streak__ladder"
            role="img"
            aria-label="${passed} of ${STREAK_MILESTONES.length} milestones reached"
          >
            ${stars}
          </div>
        </div>
        <span class="recap__overview-narrative">
          ${next ? `${escapeText(dayCount(next - streak))} to a ${next}-day streak.` : "Past every milestone."}
        </span>
      </div>
    </div>`;
}

// Its own range label: 90 days is not the stretch the section above covers, and a
// grid of 90 cells states no period on its own. The streak figures used to sit in
// this card's header — they are their own widgets now, so the grid is only the grid.
function renderCalendar({ calendar, calendarLabel }) {
  const cells = calendar
    .map((level) => `<span class="insights-calendar__cell insights-calendar__cell--${level}"></span>`)
    .join("");
  return `
    <div class="recap__widget">
      <h3 class="insights-bars__title">Creation activity</h3>
      <span class="insights-calendar__range">${escapeText(calendarLabel)}</span>
      <div class="insights-calendar__grid" role="img" aria-label="${escapeText(calendarSummary(calendar))}">
        ${cells}
      </div>
      ${renderIntensityLegend()}
    </div>`;
}

// The one conclusion on this tab, and no card around it: a card frames data, and
// this is the sentence read off the grid above it. .editorial-lead is the app's
// existing treatment for exactly that — prose, no surface — so it is reused rather
// than restyled. It stays in this column, under the grid it was read from, because
// full-width it would read as a conclusion about the whole section.
function renderWorkNote(note) {
  return `
    <p class="editorial-lead">
      <i class="ap-icon-quote" aria-hidden="true"></i>
      ${escapeText(note)}
    </p>`;
}
