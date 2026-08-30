// Insights › Objectives — the board (handoff 5a/5b/5c/6a). Objectives are the
// unit; the Playbook is where they live. Board by default: three status
// columns (the COLUMN carries the status — a card never restates it), grace
// entries in a folded COLLECTING rail; "Group by playbook" slices the same
// board into lanes (an empty cell stays visible — the absence is the
// information); the List toggle is the master-detail — a rail of objectives
// sorted most-at-risk first, and the SAME detail component the board's modal
// renders, in place. Filters and sort act on every column at once; view
// preferences persist per user (objectives-model).

import { escapeHtml as esc, escapeAttr } from "../../utils.js?v=45";
import { getContexts, getContextById, updateContext } from "../../contexts-store.js?v=97";
import { isRateMetric, measureState } from "../../objective-measures.js?v=7";
import {
  loadPrefs,
  savePrefs,
  boardEntries,
  columns,
  COLUMN_META,
  sortEntries,
  SORTS,
  weakestMeasure,
  listSummary,
  sparklinePoints,
} from "./objectives-model.js?v=1";
import { renderObjectiveDetail } from "./objective-detail.js?v=3";
import { open as openDetailModal } from "../../components/objective-detail-modal.js?v=2";
import { openObjectiveInChat } from "../../objective-flow.js?v=1";
import { open as openObjectiveModal } from "../../components/objective-modal.js?v=2";
import { renderFirstRun } from "./parts.js?v=18";

const STATE_TONE = { on: "green", soft: "yellow", off: "red" };
const VERDICT_WORD_CLASS = {
  "at-risk": "insights-verdict--at-risk",
  watch: "insights-verdict--watch",
  strong: "insights-verdict--strong",
};

// View state that is NOT a preference: which lanes are folded, whether the
// collecting rail is unfolded, which list row is selected, which measure the
// list panel has expanded. Resets on reload on purpose.
let collapsedLanes = new Set();
let collectingOpen = false;
let selectedKey = null;
let listExpandedId = null;
// The flattened order of the last paint — the modal's ↑↓ walks it.
let flatOrder = [];

export function renderObjectivesTab() {
  const prefs = loadPrefs();
  if (getContexts().length === 0) return renderFirstRun("objectives");
  const entries = boardEntries({ playbookFilter: prefs.playbookFilter });
  let view;
  if (prefs.viewMode === "list") view = renderList(entries, prefs);
  else if (prefs.groupByPlaybook) view = renderLanes(entries, prefs);
  else view = renderBoard(entries, prefs);
  return `
    <div class="objv">
      ${renderToolbar(prefs)}
      ${view}
    </div>`;
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function renderToolbar(prefs) {
  // Icon-only: the view switch is a display preference, not navigation — it
  // sits with the other reading controls (filter, sort) and stays quiet.
  const seg = (id, label, icon) => `
    <button type="button"
      class="ap-segmented-control__segment ${prefs.viewMode === id ? "ap-segmented-control__segment--selected" : ""}"
      data-obj-view="${id}" aria-pressed="${prefs.viewMode === id}" aria-label="${label} view" title="${label}">
      <i class="${icon}" aria-hidden="true"></i>
    </button>`;
  const playbookOptions = [
    { value: "", label: "All playbooks" },
    ...getContexts().map((c) => ({ value: c.id, label: c.name })),
  ];
  const groupToggle =
    prefs.viewMode === "board"
      ? `<label class="ap-toggle-container objv__group${prefs.groupByPlaybook ? " is-on" : ""}">
           <input type="checkbox" data-obj-group ${prefs.groupByPlaybook ? "checked" : ""} />
           <i></i><span>Group by playbook</span>
         </label>`
      : "";
  return `
    <div class="objv__toolbar">
      <span class="objv__spacer"></span>
      ${renderToolbarSelect({
        value: prefs.playbookFilter,
        options: playbookOptions,
        attr: "data-obj-filter-pick",
        ariaLabel: "Filter by Playbook",
      })}
      ${renderToolbarSelect({
        value: prefs.sort,
        options: SORTS.map((s) => ({ value: s.id, label: s.label })),
        attr: "data-obj-sort-pick",
        ariaLabel: "Sort objectives",
      })}
      ${groupToggle}
      <div class="ap-segmented-control objv__viewswitch" role="group" aria-label="View as list or board">
        ${seg("list", "List", "ap-icon-view-list")}
        ${seg("board", "Board", "ap-icon-bar-graph")}
      </div>
      <button type="button" class="ap-button primary blue" data-obj-new>
        <i class="ap-icon-plus" aria-hidden="true"></i><span>New objective</span>
      </button>
    </div>`;
}

function renderToolbarSelect({ value, options, attr, ariaLabel }) {
  const selected = options.find((o) => o.value === value) || options[0];
  return `
    <details class="ap-select objv__select" data-obj-select>
      <summary class="ap-select-trigger">
        <span class="ap-select-value">${esc(selected.label)}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown" role="listbox" aria-label="${escapeAttr(ariaLabel)}">
        <div class="ap-select-options">
          ${options
            .map(
              (o) => `
              <div class="ap-select-option${o.value === selected.value ? " selected" : ""}" ${attr}="${escapeAttr(o.value)}" role="option" aria-selected="${o.value === selected.value}">
                <span class="ap-select-option-text">${esc(o.label)}</span>
                ${o.value === selected.value ? `<i class="ap-icon-check" aria-hidden="true"></i>` : ""}
              </div>`,
            )
            .join("")}
        </div>
      </div>
    </details>`;
}

// ── Cards ────────────────────────────────────────────────────────────────────

function measureQualifier(m) {
  if (isRateMetric(m.metricId)) return `hold ${m.target || "—"}`;
  if (m.scopeLabel) return m.scopeLabel;
  return "all networks";
}

function renderCardMeasureRow(m, { proxy = false } = {}) {
  const rate = isRateMetric(m.metricId);
  const tone = STATE_TONE[measureState(m)] || "grey";
  const viz = rate
    ? `<svg class="objv__spark objv__spark--${tone}" viewBox="0 0 70 16" aria-hidden="true"><polyline points="${sparklinePoints(
        m.trend?.pct ?? 0,
        { n: 7, w: 70, h: 16, pad: 2 },
      )}"></polyline></svg>`
    : `<span class="objv__minibar"><span class="objv__minifill objv__minifill--${tone}" style="width: ${m.progressPct ?? 0}%"></span></span>`;
  const value = rate
    ? `<span class="objv__cardvalue">${esc(m.baselineValue)}</span>`
    : `<span class="objv__cardvalue objv__cardvalue--${tone}">${m.progressPct ?? "—"}%</span>`;
  return `
    <span class="objv__cardmeasure">
      <span class="objv__cardmetric">${esc(m.metricLabel)} <span class="objv__cardqual">· ${esc(proxy ? "proxy" : measureQualifier(m))}</span></span>
      ${viz}
      ${value}
    </span>`;
}

// The verdict, as a word — the same word the List rows print, so a card and a
// row can never disagree on what a tier is called.
function verdictWord(entry) {
  if (entry.collecting) return `<span class="insights-verdict objv__status--collecting">Collecting</span>`;
  if (!entry.verdict?.tier) return "";
  return `<span class="insights-verdict ${VERDICT_WORD_CLASS[entry.verdict.tier] || ""}">${esc(entry.verdict.label || "")}</span>`;
}

function renderCard(entry, { eyebrow = true } = {}) {
  const r = entry.resolved;
  const parked = r.status === "parked";
  const all = parked ? [r.proxy] : r.measures;
  const measures = all.slice(0, 3);
  const hidden = all.length - measures.length;
  // Pace/trend stay on the measures (and in the detail) — the card's one
  // judgment is the objective verdict, top right, on the playbook row.
  const note = entry.collecting
    ? `<span class="objv__cardnote">day ${r.grace.day} of ${r.grace.of} · no verdict</span>`
    : "";
  const top = eyebrow
    ? `<span class="objv__cardeyebrow"><i class="ap-icon-target objv__cardmark" aria-hidden="true"></i>${esc(entry.playbookName)}<span class="objv__spacer"></span>${verdictWord(entry)}</span>
       <span class="objv__cardname">${esc(entry.label)}</span>`
    : `<span class="objv__cardline"><span class="objv__cardname">${esc(entry.label)}</span><span class="objv__spacer"></span>${verdictWord(entry)}</span>`;
  return `
    <button type="button" class="ap-card objv__card" data-obj-card="${escapeAttr(entry.key)}" aria-label="Open ${esc(entry.label)}">
      ${top}
      ${measures.map((m) => renderCardMeasureRow(m, { proxy: parked })).join("")}
      ${hidden > 0 ? `<span class="objv__cardmore"><span class="ap-badge grey">+${hidden}</span>more ${hidden === 1 ? "measure" : "measures"}</span>` : ""}
      ${note}
    </button>`;
}

// ── Board (5a) ───────────────────────────────────────────────────────────────

function renderColumnHead(meta, count) {
  return `
    <span class="objv__colhead">
      <span class="objv__dot objv__dot--${meta.tone}"></span>
      <span class="objv__colname">${esc(meta.label)}</span>
      <span class="objv__colcount">${count}</span>
    </span>`;
}

function renderBoard(entries, prefs) {
  const sorted = sortEntries(entries, prefs.sort);
  const cols = columns(sorted);
  flatOrder = COLUMN_META.flatMap((meta) => cols[meta.id]);
  const columnHtml = COLUMN_META.map(
    (meta, i) => `
      ${i > 0 ? `<span class="objv__rule"></span>` : ""}
      <div class="objv__col">
        ${renderColumnHead(meta, cols[meta.id].length)}
        ${cols[meta.id].map((e) => renderCard(e)).join("") || `<div class="objv__emptycell">—</div>`}
      </div>`,
  ).join("");
  const collecting = cols.collecting;
  const rail = collecting.length
    ? collectingOpen
      ? `<span class="objv__rule"></span>
         <div class="objv__col objv__col--collecting">
           <button type="button" class="objv__colhead objv__colhead--btn" data-obj-collecting-toggle>
             <span class="objv__dot objv__dot--dashed"></span>
             <span class="objv__colname">Collecting</span>
             <span class="objv__colcount">${collecting.length}</span>
           </button>
           ${collecting.map((e) => renderCard(e)).join("")}
         </div>`
      : `<span class="objv__rule"></span>
         <button type="button" class="objv__collectrail" data-obj-collecting-toggle aria-label="Show collecting objectives">
           <span class="objv__collectlabel">Collecting · ${collecting.length}</span>
           <span class="objv__dot objv__dot--dashed"></span>
         </button>`
    : "";
  if (collectingOpen) flatOrder = flatOrder.concat(collecting);
  return `<div class="objv__board">${columnHtml}${rail}</div>`;
}

// ── Lanes (5b) ───────────────────────────────────────────────────────────────

function laneSummary(laneEntries) {
  const sorted = sortEntries(laneEntries, "risk");
  const weakEntry = sorted[0];
  if (!weakEntry) return "";
  const tone = weakEntry.collecting
    ? "dashed"
    : weakEntry.verdict.tier === "strong"
      ? "green"
      : weakEntry.verdict.tier === "watch"
        ? "yellow"
        : "red";
  const weak = weakestMeasure(weakEntry);
  const figure = weak
    ? isRateMetric(weak.metricId)
      ? `${weak.baselineValue} / ${weak.target}`
      : `${weak.progressPct ?? "—"}%`
    : "";
  return `<span class="objv__dot objv__dot--${tone}"></span><span class="objv__lanesum objv__lanesum--${tone}">${esc(weakEntry.label)}${figure ? ` · ${esc(figure)}` : ""}</span>`;
}

function renderLanes(entries, prefs) {
  // The grace lane is deliberately absent from the grouped board (the design's
  // own call) — collecting entries simply don't slot into status columns.
  const byCtx = new Map();
  entries.forEach((e) => {
    if (!byCtx.has(e.ctxId)) byCtx.set(e.ctxId, []);
    byCtx.get(e.ctxId).push(e);
  });
  const lanes = [...byCtx.entries()].sort((a, b) => a[1][0].playbookName.localeCompare(b[1][0].playbookName));
  flatOrder = [];
  const heads = COLUMN_META.map(
    (meta, i) =>
      `${i > 0 ? `<span class="objv__rule objv__rule--head"></span>` : ""}${renderColumnHead(
        meta,
        entries.filter((e) => !e.collecting && e.verdict.tier === meta.id).length,
      )}`,
  ).join("");
  const laneHtml = lanes
    .map(([ctxId, laneEntries]) => {
      const name = laneEntries[0].playbookName;
      const active = laneEntries.filter((e) => !e.collecting);
      const folded = collapsedLanes.has(ctxId);
      const banner = `
        <div class="objv__lane">
          <button type="button" class="objv__lanetoggle" data-obj-lane="${escapeAttr(ctxId)}" aria-expanded="${!folded}">
            <i class="${folded ? "ap-icon-chevron-right" : "ap-icon-chevron-up"}" aria-hidden="true"></i>
            <span class="objv__lanename">${esc(name)}</span>
            <span class="objv__lanecount">${active.length} objective${active.length === 1 ? "" : "s"}</span>
          </button>
          ${folded ? laneSummary(active) : `<span class="objv__spacer"></span><a class="ap-link standalone small" href="#/playbook/${escapeAttr(ctxId)}">Open playbook<i class="ap-icon-arrow-right" aria-hidden="true"></i></a>`}
        </div>`;
      if (folded) return banner;
      const cols = columns(active);
      flatOrder = flatOrder.concat(COLUMN_META.flatMap((meta) => cols[meta.id]));
      const cells = COLUMN_META.map(
        (meta, i) => `
          ${i > 0 ? `<span class="objv__rule"></span>` : ""}
          <div class="objv__col">
            ${
              cols[meta.id].length
                ? cols[meta.id].map((e) => renderCard(e, { eyebrow: false })).join("")
                : `<div class="objv__emptycell">${meta.id === "strong" ? "nothing on track yet" : "—"}</div>`
            }
          </div>`,
      ).join("");
      return `${banner}<div class="objv__lanecells">${cells}</div>`;
    })
    .join("");
  return `<div class="objv__lanes"><div class="objv__laneheads">${heads}</div>${laneHtml}</div>`;
}

// ── List (5c) ────────────────────────────────────────────────────────────────

function renderList(entries, prefs) {
  // The list honours every sort the trigger offers — it used to coerce
  // "by playbook" to "risk" while the select still claimed playbook order.
  const active = sortEntries(
    entries.filter((e) => !e.collecting),
    prefs.sort,
  );
  const collecting = entries.filter((e) => e.collecting);
  const rows = [...active, ...collecting];
  flatOrder = rows;
  const selected = rows.find((e) => e.key === selectedKey) || rows[0];
  if (!rows.length) {
    return `
      <div class="objv__emptyrail">
        <p>No objectives in this Playbook yet.</p>
        <button type="button" class="ap-button primary blue" data-obj-new>
          <i class="ap-icon-plus" aria-hidden="true"></i><span>New objective</span>
        </button>
      </div>`;
  }
  const items = rows
    .map((e) => {
      const on = selected && e.key === selected.key;
      const status = verdictWord(e);
      return `
        <button type="button" class="objv__rowitem${on ? " is-selected" : ""}" data-obj-row="${escapeAttr(e.key)}"${on ? ` aria-current="true"` : ""}>
          <span class="objv__rowline"><span class="objv__rowname">${esc(e.label)}</span><span class="objv__spacer"></span>${status}</span>
          <span class="objv__rowsummary">${esc(listSummary(e))}</span>
        </button>`;
    })
    .join("");
  const panel = selected
    ? `<div class="objv__detailcard">${renderObjectiveDetail(selected, {
        expandedId: listExpandedId,
        host: "panel",
      })}</div>`
    : "";
  return `
    <div class="objv__split">
      <div class="objv__raillist" aria-label="Objectives, most at risk first">
        ${items}
        <span class="objv__spacer"></span>
        <button type="button" class="objv__newrow" data-obj-new><span>+ New objective</span></button>
      </div>
      <div class="objv__detail">${panel}</div>
    </div>`;
}

// ── Bind ─────────────────────────────────────────────────────────────────────

function entryByKey(key) {
  return flatOrder.find((e) => e.key === key) || boardEntries().find((e) => e.key === key);
}

function commitFor(ctxId) {
  return () => updateContext(ctxId, { updatedAt: "just now" });
}

function adjustEntry(entry) {
  const ctx = getContextById(entry.ctxId);
  if (!ctx) return;
  openObjectiveModal({ data: ctx, label: entry.label, mode: "adjust", onChange: commitFor(entry.ctxId) });
}

export function bindObjectivesTab(root, period) {
  void period;
  const repaint = () => {
    const panel = root.querySelector(".insights-view__panel");
    if (panel) panel.innerHTML = renderObjectivesTab();
  };

  const onClick = (event) => {
    // One open toolbar dropdown at a time.
    const inSelect = event.target.closest("[data-obj-select]");
    root.querySelectorAll("[data-obj-select][open]").forEach((d) => {
      if (d !== inSelect) d.removeAttribute("open");
    });

    const view = event.target.closest("[data-obj-view]");
    if (view) {
      savePrefs({ viewMode: view.dataset.objView });
      repaint();
      return;
    }
    const filterPick = event.target.closest("[data-obj-filter-pick]");
    if (filterPick) {
      savePrefs({ playbookFilter: filterPick.dataset.objFilterPick });
      repaint();
      return;
    }
    const sortPick = event.target.closest("[data-obj-sort-pick]");
    if (sortPick) {
      savePrefs({ sort: sortPick.dataset.objSortPick });
      repaint();
      return;
    }
    const lane = event.target.closest("[data-obj-lane]");
    if (lane) {
      const id = lane.dataset.objLane;
      if (collapsedLanes.has(id)) collapsedLanes.delete(id);
      else collapsedLanes.add(id);
      repaint();
      return;
    }
    if (event.target.closest("[data-obj-collecting-toggle]")) {
      collectingOpen = !collectingOpen;
      repaint();
      return;
    }
    const card = event.target.closest("[data-obj-card]");
    if (card) {
      const key = card.dataset.objCard;
      const index = flatOrder.findIndex((e) => e.key === key);
      openDetailModal({ entries: flatOrder, index: Math.max(0, index), onAdjust: adjustEntry });
      return;
    }
    const row = event.target.closest("[data-obj-row]");
    if (row) {
      selectedKey = row.dataset.objRow;
      listExpandedId = null;
      repaint();
      return;
    }
    // The list panel's own detail interactions (the modal handles its own).
    const toggle = event.target.closest("[data-objd-measure-toggle]");
    if (toggle && event.target.closest(".objv__detailcard")) {
      // Clicking the open measure folds it — "none" collapses everything,
      // where null would fall back to the weakest-measure default.
      listExpandedId = toggle.getAttribute("aria-expanded") === "true" ? "none" : toggle.dataset.objdMeasureToggle;
      repaint();
      return;
    }
    if (event.target.closest("[data-objd-adjust]") && event.target.closest(".objv__detailcard")) {
      const key = event.target.closest("[data-objd-key]")?.dataset.objdKey;
      const entry = key && entryByKey(key);
      if (entry) adjustEntry(entry);
      return;
    }
    // The Next move's door — a chat pre-loaded with this objective.
    if (event.target.closest("[data-objd-next-chat]") && event.target.closest(".objv__detailcard")) {
      const key = event.target.closest("[data-objd-key]")?.dataset.objdKey;
      const entry = key && entryByKey(key);
      if (entry) openObjectiveInChat(entry);
      return;
    }
    if (event.target.closest("[data-objd-ga]") && event.target.closest(".objv__detailcard")) {
      import("../../components/toast.js?v=44").then(({ showToast }) =>
        showToast("Google Analytics isn't wired up in this prototype"),
      );
      return;
    }
    if (event.target.closest("[data-obj-new]")) {
      openObjectiveModal({
        mode: "create",
        contextId: loadPrefs().playbookFilter || null,
        onChange: (ctxId) => {
          if (ctxId) updateContext(ctxId, { updatedAt: "just now" });
        },
      });
      return;
    }
    const groupInput = event.target.closest("[data-obj-group]");
    if (groupInput) {
      // Checkbox click — read AFTER the toggle applied.
      window.setTimeout(() => {
        savePrefs({ groupByPlaybook: !!root.querySelector("[data-obj-group]")?.checked });
        repaint();
      }, 0);
    }
  };

  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}
