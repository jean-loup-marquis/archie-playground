import { escapeText } from "../../utils.js?v=45";
import { archieUsage, toneDistribution } from "../../mocks.js?v=111";
import { getContexts } from "../../contexts-store.js?v=97";
import { renderEditorialBanner } from "../../components/editorial-banner.js?v=27";
import { renderWidgetCard } from "../../report-widgets/widget-card.js?v=26";
import { renderOverviewCard, toOverviewData } from "../../report-widgets/widget-overview.js?v=25";
import { buildCategoryBarChartSeries } from "../../report-widgets/chart-builders.js?v=26";

// Insights › Usage — what Archie produced, how you work with it, and your voice.
//
// The counterpoint to Performance: nothing here compares a number to a goal. Ranges
// differ per card on purpose, and a second range is not the problem a page like this
// has — an unstated one is.
//
// Which is where this tab currently stands: the lead opens the first section and
// states "this month" for its own word count, the calendar states its own 90 days,
// and the four produced figures state nothing. See the spec's decision 5.

// ── This half has a job now, 2026-08-24 ─────────────────────────────────────
// It landed first for a while, on the argument that "the hub welcomes before it
// triages". That argument went with the triage, and leaving the tab as the "fun"
// one left it with a vibe instead of a purpose.
//
// Its purpose is the RENEWAL ARGUMENT: this is the half you show when someone asks
// whether Archie is worth its price, and it is the only place that question is
// served (J3 in the main doc). Which is also the rule for what belongs in it —
// something that PROVES, not something that flatters.
//
// Cut on that rule: the current-streak ladder, the longest-streak record, the
// 90-day activity grid and the sentence read off it. A streak is the reader's own
// behaviour rendered as a game, and Agorapulse has refused gamification before;
// none of the four says anything about what Archie is worth. What survives is what
// a buyer can check: how much of the output survived untouched, how much of it
// there was, and where it went.
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
      <h2 class="insights-view__section-title">Where it went</h2>
      <div class="insights-usage__work">
        ${renderBars(
          "Where you publish",
          work.networks.map((n) => ({ label: n.label, value: n.share, valueLabel: `${n.share}%` })),
          { colorByCategory: true },
        )}
        ${renderBars("The tone that recurs", toneBars())}
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

// Removed 2026-08-24 with the ambience they served: INTENSITY_LABELS,
// calendarSummary, renderIntensityLegend, dayCount, STREAK_MILESTONES,
// renderStreak, renderLongestStreak, renderCalendar and renderWorkNote. They
// existed for the 90-day activity grid and the two streak cards, and the whole
// point of the trim was that a streak proves nothing about what Archie is worth.
// Their CSS goes with them; see styles/screens/insights.css.
