import { escapeText, escapeAttr } from "../../utils.js?v=44";
import { getContexts } from "../../contexts-store.js?v=96";
import { objectiveCardsFor, archieImpact, playbookReportFor } from "../../mocks.js?v=110";
import { navigate } from "../../router.js?v=53";
import { renderEmptyState } from "../../components/empty-state.js?v=25";
import { renderEditorialBanner } from "../../components/editorial-banner.js?v=26";
import { renderWidgetCard } from "../../report-widgets/widget-card.js?v=25";
import { toOverviewData } from "../../report-widgets/widget-overview.js?v=24";
import { showToast } from "../../components/toast.js?v=43";
import { isFlagOn } from "../../feature-flags.js?v=43";
import {
  objectiveTier,
  playbookScore,
  TIER_LABELS,
  TIER_ORDER,
  TIER_STATUS_CLASS,
} from "../../objective-scoring.js?v=24";
import { alertState, mutedUntilLabel, reopen, subscribe as subscribeAlerts } from "../../objective-alerts-store.js?v=5";

// Insights › Performance — the portfolio layer, above a single Playbook's detail.
//
// A Playbook page answers "how is THIS Playbook doing?". This tab answers
// "where should I look first?" across all of them — so everything here is
// comparison and triage: one health card per Playbook, then every objective
// flattened into one sortable table with the worst first.
//
// It is deliberately self-contained: no Agorapulse subscription is required to
// read it, which is the whole point of putting analytics at Archie's root. The
// Report Studio bridge at the bottom is the one place that acknowledges the paid
// product, and it argues rather than nags.
//
// TWO LEVELS, and this is where the six metric widgets live now. They were drawn
// for a Performance section inside the Playbook, which is the one place they
// cannot be: a Playbook is a brand's context — a CLAUDE.md, almost frozen, read
// by other surfaces — so putting a report in it obliges the user to go back to a
// page they have no other reason to open. Here the same six answer the question
// the card above them just raised, on the page the user chose to open.

const TIER_ORDER_KEYS = ["at-risk", "watch", "strong"];

const STATUS_FILTERS = [
  { id: "all", label: "All statuses" },
  { id: "attention", label: "Needs attention" },
  { id: "strong", label: "Strong only" },
];

let pageState = { playbook: "all", status: "all", selected: null };

// One row per objective per Playbook — the table's unit is an objective, not a
// Playbook, because that's the grain you act at.
function allRows() {
  return getContexts().flatMap((context) =>
    objectiveCardsFor(context).map((o) => ({
      ...o,
      tier: objectiveTier(o.progress, o.variationPercent),
      playbookId: context.id,
      playbookName: context.name,
      playbookColor: context.color || "orange",
      // What the reader has already done about it, which the numbers cannot say.
      // This is the whole reason the table is where an alert's state lives: the
      // chat opening shows only what is still asking, so without a column here a
      // muted objective would have no surface at all.
      alert: alertState(context.id, o.objective),
    })),
  );
}

function visibleRows(rows) {
  return rows
    .filter((r) => pageState.playbook === "all" || r.playbookId === pageState.playbook)
    .filter((r) => {
      if (pageState.status === "attention") return r.tier !== "strong";
      if (pageState.status === "strong") return r.tier === "strong";
      return true;
    })
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.progress - b.progress);
}

export function renderPerformanceTab() {
  const contexts = getContexts();
  const rows = allRows();

  if (contexts.length === 0) {
    return renderEmptyState({
      icon: "ap-icon-bar-graph",
      title: "Nothing to measure yet",
      body: "Create a Playbook and declare its goals — this page starts reporting as soon as one has objectives.",
      wrapperClass: "insights-view__empty",
    });
  }

  return `
    ${renderEditorial()}
    ${renderReportStudioBridge()}
    <section class="insights-view__section">
      <div class="insights-view__section-head">
        <div class="insights-view__section-text">
          <h2 class="insights-view__section-title">Playbook health</h2>
          <p class="insights-view__section-note">
            Across your ${contexts.length} ${contexts.length === 1 ? "Playbook" : "Playbooks"}. Scored out of 100 —
            the average progress of a Playbook's objectives, lowered when a trend is flat or falling.
          </p>
        </div>
        ${renderTierLegend()}
      </div>
      <div class="insights-view__cards">${contexts.map(renderHealthCard).join("")}</div>
    </section>
    ${renderPlaybookLevel(contexts)}
    <section class="insights-view__section">
      <div class="insights-view__section-head">
        <h2 class="insights-view__section-title">Objectives</h2>
      </div>
      ${renderTableControls(contexts, visibleRows(rows).length, rows.length)}
      ${renderTable(visibleRows(rows))}
    </section>`;
}

// A heading, then the lead sentence, then the figures it alludes to as real Report
// Studio widgets — the same mini card a Playbook's report uses, so the hub reads as
// the portfolio view of one product rather than a second design.
//
// The heading is what stops the lead floating between the tabs and the first section:
// it belongs to a block now, the same shape the Usage tab opens with. It also carries
// the period this tab used to state in a bare line above everything — the lead's own
// "in the last 30 days" says it in a sentence, which is where it reads.
function renderEditorial() {
  const impact = archieImpact();
  const lead = renderEditorialBanner(impact);
  const widgets = (impact?.widgets || [])
    .map((w) => renderWidgetCard({ overviewData: toOverviewData(w) }, { size: "mini" }))
    .join("");
  if (!lead && !widgets) return "";

  return `
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">What your content did</h2>
      ${lead}
      ${widgets ? `<div class="insights-view__mini-row">${widgets}</div>` : ""}
    </section>`;
}

// On the cards the tier is carried by colour alone — the chips show objective
// names, not statuses — so without a key the amber/red distinction is decoration.
// Vocabulary left as-is on purpose: renaming a tier is a product decision.
function renderTierLegend() {
  return `
    <ul class="analytics-legend" aria-label="What the colours mean">
      ${TIER_ORDER_KEYS.map(
        (t) => `
        <li class="analytics-legend__item">
          <span class="analytics-legend__swatch analytics-legend__swatch--${t}" aria-hidden="true"></span>
          ${escapeText(TIER_LABELS[t])}
        </li>`,
      ).join("")}
    </ul>`;
}

// Annular gauge, not a filled disc: the hole is what stops it reading as a pie
// chart of parts when it's actually one score out of 100.
function renderRing(score, tier) {
  return `
    <div
      class="analytics-card__ring analytics-card__ring--${tier}"
      style="--ring-progress: ${Math.round(score)}"
      role="img"
      aria-label="Health score ${Math.round(score)} out of 100"
    >
      <span class="analytics-card__ring-value">${Math.round(score)}</span>
      <span class="analytics-card__ring-scale">/100</span>
    </div>`;
}

function renderHealthCard(context) {
  const objectives = objectiveCardsFor(context);
  if (objectives.length === 0) {
    return `
      <article class="ap-card analytics-card analytics-card--empty" data-analytics-playbook="${escapeAttr(context.id)}">
        <h3 class="analytics-card__name">${escapeText(context.name)}</h3>
        <p class="analytics-card__none">No goals declared yet</p>
      </article>`;
  }

  const { score, tier } = playbookScore(objectives);
  // Grey unless the objective is the reason to look — a card where nothing is
  // wrong should read as quiet, not as four green badges competing for attention.
  // `no-dot` because the chip's own tint already carries the verdict; a dot on
  // top of it just adds noise at this size.
  const chips = objectives
    .map((o) => {
      const t = objectiveTier(o.progress, o.variationPercent);
      const variant = t === "strong" ? "grey" : TIER_STATUS_CLASS[t];
      return `<span class="ap-status ${variant} no-dot analytics-card__chip">${escapeText(o.objective)}</span>`;
    })
    .join("");

  const selected = selectedId() === context.id;
  return `
    <article
      class="ap-card analytics-card${selected ? " is-selected" : ""}"
      data-analytics-playbook="${escapeAttr(context.id)}"
      role="button"
      tabindex="0"
      aria-pressed="${selected ? "true" : "false"}"
    >
      <div class="analytics-card__top">
        ${renderRing(score, tier)}
        <div class="analytics-card__id">
          <h3 class="analytics-card__name">${escapeText(context.name)}</h3>
          <span class="analytics-card__verdict analytics-card__verdict--${tier}">${TIER_LABELS[tier]}</span>
        </div>
      </div>
      <div class="analytics-card__chips">${chips}</div>
    </article>`;
}

// Which Playbook the detail below is showing. Defaults to the WORST scoring one
// rather than to nothing: this page is triage, the cards above are already sorted
// by that logic, and an empty slot under them would make the reader click before
// the page says anything.
function selectedId() {
  const contexts = getContexts();
  if (pageState.selected && contexts.some((c) => c.id === pageState.selected)) return pageState.selected;
  const ranked = contexts
    .map((c) => ({ id: c.id, ...playbookScore(objectiveCardsFor(c)) }))
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.score - b.score);
  return ranked[0]?.id || null;
}

// Level two: one Playbook, in the report's own language — the same six metric
// cards Report Studio draws, with that Playbook's numbers. The editorial lead
// above them is the Playbook's own, so the block opens on a sentence rather than
// on a grid.
function renderPlaybookLevel(contexts) {
  const id = selectedId();
  const context = contexts.find((c) => c.id === id);
  if (!context) return "";

  const lead = renderEditorialBanner(archieImpact(context));
  const widgets = playbookReportFor(context)
    .map((w) =>
      w.size === "mini"
        ? renderWidgetCard({ overviewData: toOverviewData(w) }, { size: "mini" })
        : renderWidgetCard({ overviewData: toOverviewData({ ...w, count: w.total, variation: 0 }) }, { size: "mini" }),
    )
    .join("");

  return `
    <section class="insights-view__section">
      <div class="insights-view__section-head">
        <div class="insights-view__section-text">
          <h2 class="insights-view__section-title">${escapeText(context.name)}</h2>
          <p class="insights-view__section-note">The last 30 days of what Archie published under this Playbook.</p>
        </div>
        <a class="ap-link standalone small" href="#/playbook/${escapeAttr(context.id)}">
          Open the Playbook<i class="ap-icon-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
      ${lead}
      <div class="insights-view__widgets">${widgets}</div>
    </section>`;
}

// Built on the repo's `.ap-select` <details> dropdown (same component as the
// Playbook audience picker) — one choice each, so a dropdown rather than chips.
function renderSelect({ key, label, options, selected }) {
  const current = options.find((o) => o.id === selected)?.label || label;
  const items = options
    .map((opt) => {
      const on = opt.id === selected;
      return `<div class="ap-select-option${on ? " selected" : ""}" data-analytics-filter-${key}="${escapeAttr(opt.id)}" role="option" aria-selected="${on}">
          <span class="ap-select-option-text">${escapeText(opt.label)}</span>
          ${on ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
        </div>`;
    })
    .join("");

  return `
    <details class="ap-select insights-view__select">
      <summary class="ap-select-trigger">
        <span class="ap-select-value">${escapeText(current)}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown" role="listbox" aria-label="${escapeAttr(label)}">
        <div class="ap-select-options">${items}</div>
      </div>
    </details>`;
}

function renderTableControls(contexts, shown, total) {
  const playbookOptions = [
    { id: "all", label: "All playbooks" },
    ...contexts.map((c) => ({ id: c.id, label: c.name })),
  ];

  return `
    <div class="insights-view__controls">
      <div class="insights-view__filters">
        ${renderSelect({ key: "playbook", label: "All playbooks", options: playbookOptions, selected: pageState.playbook })}
        ${renderSelect({ key: "status", label: "All statuses", options: STATUS_FILTERS, selected: pageState.status })}
      </div>
      <span class="insights-view__count">Showing ${shown} of ${total} · worst first</span>
    </div>`;
}

function renderTrendCell(o) {
  if (o.variationPercent > 0) {
    return `<span class="analytics-trend is-up"><i class="ap-icon-arrow-up" aria-hidden="true"></i>+${o.variationPercent}%</span>`;
  }
  if (o.variationPercent < 0) {
    // U+2212, matching the benchmark strings in mocks.js — a hyphen next to a
    // real minus in the same row reads as a typo.
    return `<span class="analytics-trend is-down"><i class="ap-icon-arrow-down" aria-hidden="true"></i>−${Math.abs(o.variationPercent)}%</span>`;
  }
  return `<span class="analytics-trend"><i class="ap-icon-arrow-right" aria-hidden="true"></i>flat</span>`;
}

// The Playbook cell holds a real <button> rather than the row carrying
// role="button": eight rows were mouse-only, and putting the role on the <tr>
// would have bought keyboard access by destroying the table's row semantics.
// The row stays clickable as a mouse convenience, so both work.
//
// No `title` attributes. They were hiding the actual figures — "10,400 of 20,000"
// behind "52%" — where touch, keyboard and several screen readers never reach
// them. The percentage is the triage signal; the raw numbers live on the Playbook
// page, one click away, in the open.
function renderRow(r) {
  // 3px inset accent on flagged rows — a deliberate extension of the DS table,
  // so a scan down the left edge finds what needs work without reading a column.
  const flaggedClass = r.tier === "strong" ? "" : ` is-flagged is-flagged--${r.tier}`;
  return `
    <tr class="analytics-row${flaggedClass}" data-analytics-row="${escapeAttr(r.playbookId)}">
      <td>
        <div class="ap-table-cell-content analytics-row__playbook">
          <span class="analytics-card__dot analytics-card__dot--${escapeAttr(r.playbookColor)}" aria-hidden="true"></span>
          <button type="button" class="analytics-row__open" data-analytics-row-open="${escapeAttr(r.playbookId)}">
            ${escapeText(r.playbookName)}
          </button>
        </div>
      </td>
      <td><div class="ap-table-cell-content">${escapeText(r.objective)}</div></td>
      <td class="right">
        <div class="ap-table-cell-content analytics-row__progress">
          <span class="analytics-row__pct">${r.progress}%</span>
          <span class="analytics-row__goal">${escapeText(r.value)} / ${escapeText(r.goal)}</span>
        </div>
      </td>
      <td>
        <div class="ap-table-cell-content">
          <span class="ap-status ${TIER_STATUS_CLASS[r.tier]} no-dot">${TIER_LABELS[r.tier]}</span>
        </div>
      </td>
      <td><div class="ap-table-cell-content">${renderTrendCell(r)}</div></td>
      <td>
        <div class="ap-table-cell-content">
          <span class="analytics-trend ${r.benchmarkAhead ? "is-up" : "is-down"}">
            <i class="${r.benchmarkAhead ? "ap-icon-arrow-up" : "ap-icon-arrow-down"}" aria-hidden="true"></i>${escapeText(r.benchmarkVsIndustry)}
          </span>
        </div>
      </td>
      <td><div class="ap-table-cell-content">${renderAlertCell(r)}</div></td>
    </tr>`;
}

// The alert's own state, and the way back from it. Deliberately NOT a second status
// pill: `.ap-status` means the VERDICT in this app, and a row would then carry two
// pills saying different things. This is plain text plus one transparent button —
// the state is a footnote to the verdict beside it, not a peer.
//
// "Muted until the next weekly read", never "done": the objective recovers when the
// numbers do. Bringing it back is one click, because the reader is the only one who
// knows they want to be asked again before then.
function renderAlertCell(r) {
  if (r.alert === "open") return `<span class="analytics-row__alert-none">—</span>`;
  const label = r.alert === "muted" ? `Muted ${mutedUntilLabel(r.playbookId)}` : "Set aside";
  return `
    <span class="analytics-row__alert">
      <span class="analytics-row__alert-state">${escapeText(label)}</span>
      <button
        type="button"
        class="ap-button transparent blue"
        data-alert-reopen="${escapeAttr(r.objective)}"
        data-alert-playbook="${escapeAttr(r.playbookId)}"
      >
        <span>Bring back</span>
      </button>
    </span>`;
}

function renderTable(rows) {
  const body =
    rows.length === 0
      ? `<tr><td colspan="7" class="ap-table-empty insights-view__table-empty">
          No objective matches these filters.
          <button type="button" class="ap-button transparent blue" data-analytics-clear-filters>
            <span>Clear filters</span>
          </button>
        </td></tr>`
      : rows.map(renderRow).join("");

  return `
    <table class="ap-table striped insights-view__table">
      <thead>
        <tr>
          <th>Playbook</th>
          <th>Objective</th>
          <th class="right">Progress</th>
          <th>Status</th>
          <th>Trend</th>
          <th>vs industry median</th>
          <th>Alert</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

// Two states, one slot, and the slot MOVED on 2026-08-24 — from the foot of the
// page to directly under the lead, above the first figure.
//
// It reads as a pitch at the bottom of a page and as a SCOPE STATEMENT at the top,
// and the second is what it actually is: every number below it counts the posts
// Archie published and nothing else. A caveat on the data belongs where the data
// starts. It also stops depending on someone scrolling past a thirteen-row table
// to ever meet the one thing this page exists to say it cannot do.
//
// Without Agorapulse the argument is STRUCTURAL, not a feature list: Archie can
// only see what Archie published, so the comparison you actually want is the one it
// cannot make. That's honest, and it's the only version of this pitch a solo
// creator won't resent.
// `.ap-infobox` rather than a hand-rolled banner: title + message + one action is
// exactly its anatomy, and `has-title` centres the icon for the two-line form.
// Locked uses feature-lock, the variant the DS reserves for premium — the pinned
// ui-theme 20.x has not shipped it yet, so ds-patches.css forward-ports it.
function renderReportStudioBridge() {
  const entitled = isFlagOn("agorapulseEntitlement");

  if (entitled) {
    return `
      <div class="ap-infobox info has-title">
        <i class="ap-icon-bar-graph" aria-hidden="true"></i>
        <div class="ap-infobox-content">
          <div class="ap-infobox-texts">
            <span class="ap-infobox-title">Put this in a report</span>
            <span class="ap-infobox-message">
              This page counts the posts Archie published. Drop the same figures into a Report Studio report to read
              them next to everything else you publish.
            </span>
          </div>
          <button type="button" class="ap-button primary blue" data-analytics-bridge-cta>
            <i class="ap-icon-plus"></i><span>Add to a report</span>
          </button>
        </div>
      </div>`;
  }

  return `
    <div class="ap-infobox feature-lock has-title">
      <i class="ap-icon-feature-lock" aria-hidden="true"></i>
      <div class="ap-infobox-content">
        <div class="ap-infobox-texts">
          <span class="ap-infobox-title">Compare Archie's posts to everything else you publish</span>
          <span class="ap-infobox-message">
            This page measures what Archie made. Seeing how it stacks up against the rest of your content needs
            visibility into all of it — that's what Agorapulse adds.
          </span>
        </div>
        <!-- .ap-button.locked — the DS's own lock affordance: purple, with the
             locked symbol badged on the corner. It settles a register question this
             CTA had open. The platform's paywall pattern says the upgrade button is
             the screen's main action and therefore orange primary; that would
             contradict the sentence directly above it, which is at pains to say we
             are not selling intelligence. And a stroked grey button beside a purple
             feature-lock box belongs to no family at all. Purple means feature-lock
             in this design system and means nothing else — so the button says
             "locked" without shouting "buy". -->
        <button type="button" class="ap-button locked" data-analytics-bridge-cta>
          <span>See what Agorapulse adds</span>
          <span class="ap-locked-symbol"><i class="ap-icon-feature-lock" aria-hidden="true"></i></span>
        </button>
      </div>
    </div>`;
}

// Scoped to the tab's own panel, not the whole shell: the header and tab nav
// above it are the shell's, and a filter pick has no reason to touch them.
function repaint(root) {
  const panel = root.querySelector(".insights-view__panel");
  if (panel) panel.innerHTML = renderPerformanceTab();
}

// Returns an unbind function: the shell mounts one tab at a time on a DOM
// node it reuses across navigations, so whoever binds has to hand back a way
// to remove it before the next tab binds on top.
export function bindPerformanceTab(root) {
  const onClick = (event) => {
    if (event.target.closest("[data-analytics-bridge-cta]")) {
      showToast("Report Studio isn't wired up in this prototype");
      return;
    }
    // Ahead of the row and card handlers below: this button sits INSIDE a row, and
    // the row's own click selects a Playbook.
    const reopenBtn = event.target.closest("[data-alert-reopen]");
    if (reopenBtn) {
      reopen(reopenBtn.dataset.alertPlaybook, reopenBtn.dataset.alertReopen);
      showToast("Back on the list — you'll see it when you open a chat on this Playbook");
      repaint(root);
      return;
    }
    if (event.target.closest("[data-analytics-clear-filters]")) {
      pageState = { playbook: "all", status: "all" };
      repaint(root);
      return;
    }
    const rowOpen = event.target.closest("[data-analytics-row-open]");
    if (rowOpen) {
      navigate(`/playbook/${rowOpen.dataset.analyticsRowOpen}`);
      return;
    }
    const playbookPick = event.target.closest("[data-analytics-filter-playbook]");
    if (playbookPick) {
      pageState.playbook = playbookPick.dataset.analyticsFilterPlaybook;
      repaint(root);
      return;
    }
    const statusPick = event.target.closest("[data-analytics-filter-status]");
    if (statusPick) {
      pageState.status = statusPick.dataset.analyticsFilterStatus;
      repaint(root);
      return;
    }
    // Guard the dropdown itself: clicking the trigger must open it, not fall
    // through to the card/row navigation below.
    if (event.target.closest(".ap-select")) return;

    // Selecting, not navigating. A card used to jump to the Playbook page, which
    // is exactly the trip this pass exists to stop making — the detail it wanted
    // is now the section right below.
    const card = event.target.closest("[data-analytics-playbook]");
    if (card) {
      pageState.selected = card.dataset.analyticsPlaybook;
      repaint(root);
      return;
    }
    const row = event.target.closest("[data-analytics-row]");
    if (row) navigate(`/playbook/${row.dataset.analyticsRow}`);
  };

  const onKeydown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-analytics-playbook]");
    if (!card) return;
    event.preventDefault();
    pageState.selected = card.dataset.analyticsPlaybook;
    repaint(root);
  };

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);
  // An objective muted from a chat has to drop out of this column without a
  // reload — the store notifies, this repaints.
  const offAlerts = subscribeAlerts(() => repaint(root));

  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeydown);
    offAlerts();
  };
}
