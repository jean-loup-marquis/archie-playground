import { escapeText } from "../../utils.js?v=21";
import { archieUsage } from "../../mocks.js?v=74";
import { renderEditorialBanner } from "../../components/editorial-banner.js?v=2";
import { renderMiniWidget } from "../../components/report-widget.js?v=3";

// Insights › Usage — what Archie produced, and how you work with it.
//
// The counterpoint to Performance: nothing here compares a number to a goal. Ranges
// differ per card on purpose and each one says so — a bare number is what is
// forbidden, not a second range.

export function renderUsageTab() {
  const { lead, produced } = archieUsage();

  return `
    <p class="insights-tab__period">Last 30 days</p>
    ${renderEditorialBanner({ lead })}
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">What Archie produced</h2>
      <div class="insights-usage__produced">
        ${renderGauge(produced.keptRate)}
        ${produced.widgets.map((w) => renderMiniWidget(w)).join("")}
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
