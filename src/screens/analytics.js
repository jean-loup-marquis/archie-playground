import { html, raw, escapeText, escapeAttr } from "../utils.js?v=21";
import { renderTopbar } from "../components/topbar.js?v=296";
import { getContexts, subscribe as subscribeContexts } from "../contexts-store.js?v=46";
import { objectiveCardsFor, archieImpact } from "../mocks.js?v=72";
import { navigate } from "../router.js?v=30";
import { renderEmptyState } from "../components/empty-state.js?v=1";
import { renderEditorialBanner } from "../components/editorial-banner.js?v=2";
import { renderMiniWidget } from "../components/report-widget.js?v=2";
import { flaggedCount } from "../components/action-drawer.js?v=6";
import { showToast } from "../components/toast.js?v=20";
import { isFlagOn } from "../feature-flags.js?v=17";
import { objectiveTier, playbookScore, TIER_LABELS, TIER_ORDER, TIER_STATUS_CLASS } from "../objective-scoring.js?v=1";

// Analytics hub — the portfolio layer, above a single Playbook's detail.
//
// A Playbook page answers "how is THIS Playbook doing?". This page answers
// "where should I look first?" across all of them — so everything here is
// comparison and triage: one health card per Playbook, then every objective
// flattened into one sortable table with the worst first.
//
// It is deliberately self-contained: no Agorapulse subscription is required to
// read it, which is the whole point of putting analytics at Archie's root. The
// Report Studio bridge at the bottom is the one place that acknowledges the paid
// product, and it argues rather than nags.

const STATUS_FILTERS = [
  { id: "all", label: "All statuses" },
  { id: "attention", label: "Needs attention" },
  { id: "strong", label: "Strong only" },
];

let unsubscribe = null;
let pageState = { playbook: "all", status: "all" };

export function renderAnalytics(_params, target) {
  renderTopbar();
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  pageState = { playbook: "all", status: "all" };
  paint(target);
  unsubscribe = subscribeContexts(() => paint(target));

  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

function paint(target) {
  target.innerHTML = html`<section class="screen analytics-view">${raw(renderPage())}</section>`;
  bind(target);
}

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

function renderPage() {
  const contexts = getContexts();
  const rows = allRows();

  if (contexts.length === 0) {
    return html`
      <div class="analytics-view__page">
        ${raw(renderHead(0))}
        ${raw(
          renderEmptyState({
            icon: "ap-icon-bar-graph",
            title: "Nothing to measure yet",
            body: "Create a Playbook and declare its goals — this page starts reporting as soon as one has objectives.",
            wrapperClass: "analytics-view__empty",
          }),
        )}
      </div>
    `;
  }

  return html`
    <div class="analytics-view__page">
      ${raw(renderHead(flaggedCount()))} ${raw(renderEditorial())}

      <section class="analytics-view__section">
        <h2 class="analytics-view__section-title">Playbook health</h2>
        <div class="analytics-view__cards">${raw(contexts.map(renderHealthCard).join(""))}</div>
      </section>

      <section class="analytics-view__section">
        <div class="analytics-view__section-head">
          <h2 class="analytics-view__section-title">Objectives</h2>
        </div>
        ${raw(renderTableControls(contexts, visibleRows(rows).length))} ${raw(renderTable(visibleRows(rows)))}
      </section>

      ${raw(renderReportStudioBridge())}
    </div>
  `;
}

// The lead sentence, then the figures it alludes to as real Report Studio
// widgets — the same mini card a Playbook's report uses, so the hub reads as the
// portfolio view of one product rather than a second design.
function renderEditorial() {
  const impact = archieImpact();
  const widgets = (impact?.widgets || []).map((w) => renderMiniWidget(w)).join("");
  if (!widgets) return renderEditorialBanner(impact);

  return `
    <section class="analytics-view__editorial">
      ${renderEditorialBanner(impact)}
      <div class="analytics-view__mini-row">${widgets}</div>
    </section>`;
}

// The ⚡ badge is the drawer's door from this page. It carries the count so the
// page states the size of the problem before you ask.
function renderHead(flagged) {
  const sub =
    flagged > 0
      ? `${getContexts().length} Playbooks · ${flagged} ${flagged === 1 ? "objective" : "objectives"} need attention`
      : `${getContexts().length} Playbooks · every objective on track`;

  const trigger =
    flagged > 0
      ? `<button
          type="button"
          class="analytics-view__actions-trigger"
          data-open-action-drawer
          aria-label="${flagged} objectives need attention — see recommended actions"
        >
          <i class="ap-icon-sparkles" aria-hidden="true"></i>
          <span class="analytics-view__actions-count">${flagged}</span>
        </button>`
      : "";

  return html`
    <header class="analytics-view__head">
      <div class="analytics-view__head-text">
        <h1 class="analytics-view__title">Analytics</h1>
        <p class="analytics-view__sub">${sub}</p>
      </div>
      ${raw(trigger)}
    </header>
  `;
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
    </div>`;
}

function renderHealthCard(context) {
  const objectives = objectiveCardsFor(context);
  if (objectives.length === 0) {
    return `
      <article class="analytics-card analytics-card--empty" data-analytics-playbook="${escapeAttr(context.id)}">
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

  return `
    <article class="analytics-card" data-analytics-playbook="${escapeAttr(context.id)}" role="button" tabindex="0">
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
    <details class="ap-select analytics-view__select">
      <summary class="ap-select-trigger">
        <span class="ap-select-value">${escapeText(current)}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown" role="listbox" aria-label="${escapeAttr(label)}">
        <div class="ap-select-options">${items}</div>
      </div>
    </details>`;
}

function renderTableControls(contexts, shown) {
  const playbookOptions = [
    { id: "all", label: "All playbooks" },
    ...contexts.map((c) => ({ id: c.id, label: c.name })),
  ];

  return `
    <div class="analytics-view__controls">
      <div class="analytics-view__filters">
        ${renderSelect({ key: "playbook", label: "All playbooks", options: playbookOptions, selected: pageState.playbook })}
        ${renderSelect({ key: "status", label: "All statuses", options: STATUS_FILTERS, selected: pageState.status })}
      </div>
      <span class="analytics-view__count">${shown} ${shown === 1 ? "objective" : "objectives"} · sorted by status</span>
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

function renderRow(r) {
  // 3px inset accent on flagged rows — a deliberate extension of the DS table,
  // so a scan down the left edge finds what needs work without reading a column.
  const flaggedClass = r.tier === "strong" ? "" : ` is-flagged is-flagged--${r.tier}`;
  return `
    <tr class="analytics-row${flaggedClass}" data-analytics-row="${escapeAttr(r.playbookId)}">
      <td>
        <div class="ap-table-cell-content analytics-row__playbook">
          <span class="analytics-card__dot analytics-card__dot--${escapeAttr(r.playbookColor)}" aria-hidden="true"></span>
          <span>${escapeText(r.playbookName)}</span>
        </div>
      </td>
      <td><div class="ap-table-cell-content">${escapeText(r.objective)}</div></td>
      <td class="right">
        <div class="ap-table-cell-content analytics-row__pct" title="${escapeAttr(`${r.value} of ${r.goal}`)}">${r.progress}%</div>
      </td>
      <td>
        <div class="ap-table-cell-content">
          <span class="ap-status ${TIER_STATUS_CLASS[r.tier]} no-dot">${TIER_LABELS[r.tier]}</span>
        </div>
      </td>
      <td><div class="ap-table-cell-content">${renderTrendCell(r)}</div></td>
      <td>
        <div class="ap-table-cell-content">
          <span class="analytics-trend ${r.benchmarkAhead ? "is-up" : "is-down"}" title="${escapeAttr(r.benchmarkLabel)}">
            <i class="${r.benchmarkAhead ? "ap-icon-arrow-up" : "ap-icon-arrow-down"}" aria-hidden="true"></i>${escapeText(r.benchmarkVsIndustry)}
          </span>
        </div>
      </td>
    </tr>`;
}

function renderTable(rows) {
  const body =
    rows.length === 0
      ? `<tr><td colspan="6" class="ap-table-empty">No objective matches these filters.</td></tr>`
      : rows.map(renderRow).join("");

  return `
    <table class="ap-table striped analytics-view__table">
      <thead>
        <tr>
          <th>Playbook</th>
          <th>Objective</th>
          <th class="right">Progress</th>
          <th>Status</th>
          <th>Trend (30d)</th>
          <th>Benchmark</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

// Two states, one slot. Without Agorapulse the argument is STRUCTURAL, not a
// feature list: Archie can only see what Archie published, so the comparison you
// actually want is the one it cannot make. That's honest, and it's the only
// version of this pitch a solo creator won't resent.
function renderReportStudioBridge() {
  const entitled = isFlagOn("agorapulseEntitlement");

  if (entitled) {
    return `
      <section class="analytics-bridge analytics-bridge--entitled">
        <div class="analytics-bridge__text">
          <h2 class="analytics-bridge__title">Put this in a report</h2>
          <p class="analytics-bridge__body">Drop these objectives into a Report Studio report alongside everything else you publish.</p>
        </div>
        <button type="button" class="ap-button primary blue" data-analytics-bridge-cta>
          <i class="ap-icon-plus"></i><span>Add to a report</span>
        </button>
      </section>`;
  }

  return `
    <section class="analytics-bridge analytics-bridge--locked">
      <div class="analytics-bridge__text">
        <h2 class="analytics-bridge__title">
          <i class="ap-icon-lock" aria-hidden="true"></i>
          Compare Archie's posts to everything else you publish
        </h2>
        <p class="analytics-bridge__body">
          This page measures what Archie made. Seeing how it stacks up against the rest of your content needs
          visibility into all of it — that's what Agorapulse adds.
        </p>
      </div>
      <button type="button" class="ap-button stroked grey" data-analytics-bridge-cta>
        <span>Learn more</span>
      </button>
    </section>`;
}

function bind(root) {
  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-analytics-bridge-cta]")) {
      showToast("Report Studio isn't wired up in this prototype");
      return;
    }
    const playbookPick = event.target.closest("[data-analytics-filter-playbook]");
    if (playbookPick) {
      pageState.playbook = playbookPick.dataset.analyticsFilterPlaybook;
      paint(root);
      return;
    }
    const statusPick = event.target.closest("[data-analytics-filter-status]");
    if (statusPick) {
      pageState.status = statusPick.dataset.analyticsFilterStatus;
      paint(root);
      return;
    }
    // Guard the dropdown itself: clicking the trigger must open it, not fall
    // through to the card/row navigation below.
    if (event.target.closest(".ap-select")) return;

    const card = event.target.closest("[data-analytics-playbook]");
    if (card) {
      navigate(`/playbook/${card.dataset.analyticsPlaybook}`);
      return;
    }
    const row = event.target.closest("[data-analytics-row]");
    if (row) navigate(`/playbook/${row.dataset.analyticsRow}`);
  });

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-analytics-playbook]");
    if (!card) return;
    event.preventDefault();
    navigate(`/playbook/${card.dataset.analyticsPlaybook}`);
  });
}
