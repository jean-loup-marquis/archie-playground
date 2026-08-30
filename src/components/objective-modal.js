// The objective modal (handoff screen 1e) — an objective reads as a SENTENCE:
// "Grow [name] over a [window]", then MEASURED BY, each measure a compact card
// (metric · from X to Y · on which networks) whose target input matches the
// metric's type — a volume runs from→to with Archie's suggestion marked, a
// rate holds a bar ("hold above 3.5%"). Adding a measure slides this same
// dialog into the metric catalogue (objective-catalog-panel's shared flow).
// The status inset says the one thing worth saying: the verdict derives from
// the measures, nothing to configure.
//
// One modal, two modes:
//   create — a STAGED draft: nothing touches the Playbook until "Create
//            objective", which writes the label + its override ({measures,
//            window, grace day 1 of 7, origin:"user"}) and notifies. Naming
//            the objective resolves it live: a name that couples pre-fills
//            Archie's suggested measures, a name that doesn't reads as coming
//            soon. From Insights the sentence gains "for [Playbook]" — the
//            design assumes the playbook is known; documented deviation.
//   adjust — the same staged form seeded from an EXISTING objective; "Save
//            changes" applies rename + measures + window in one write.
//
// Replaces objective-editor-modal (the field-stack editor): the sentence form
// is the editor now. Body-level, modal-coordinator, closes on route change.

import { escapeHtml as esc } from "../utils.js?v=45";
import { requestOpen, notifyClose } from "../modal-coordinator.js?v=35";
import { getContexts } from "../contexts-store.js?v=97";
import { createCatalogFlow } from "./objective-catalog-panel.js?v=1";
import {
  resolveObjectives,
  materializeMeasureEntries,
  metricLabel,
  metricType,
  isRateMetric,
  scopedBaselineFor,
  scopeLabel,
  WINDOWS,
} from "../objective-measures.js?v=7";

const MODAL_ID = "objectiveModal";

let backdrop = null;
let panel = null;
let bodyEl = null;
let footEl = null;
let titleEl = null;
let initialized = false;
let idSeq = 0;

// The staged draft — nothing below writes to the Playbook until Create/Save.
let draft = null; // { mode, data, contextId, originalLabel, name, window, measures[], onChange }
let catalogFlow = null; // the embedded 2c/2d flow, when open

const SHELL = `
<div class="app-modal-backdrop objm__backdrop" id="objmBackdrop" hidden>
  <aside class="ap-dialog objm" id="objmModal" role="dialog" aria-modal="true" aria-label="Objective" tabindex="-1">
    <div class="ap-dialog-header"><span class="ap-dialog-title" id="objmTitle">New objective</span></div>
    <button type="button" class="ap-dialog-close" data-objm-close aria-label="Close"><i class="ap-icon-close"></i></button>
    <div class="ap-dialog-content objm__content"></div>
    <div class="ap-dialog-footer">
      <div class="ap-dialog-footer-left"></div>
      <div class="ap-dialog-footer-right" id="objmFoot"></div>
    </div>
  </aside>
</div>`;

export function init() {
  if (initialized) return;
  const host = document.createElement("div");
  host.innerHTML = SHELL;
  while (host.firstChild) document.body.appendChild(host.firstChild);
  backdrop = document.getElementById("objmBackdrop");
  panel = document.getElementById("objmModal");
  bodyEl = panel.querySelector(".objm__content");
  footEl = document.getElementById("objmFoot");
  titleEl = document.getElementById("objmTitle");

  panel.addEventListener("click", onClick);
  panel.addEventListener("input", onInput);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop && !backdrop.hidden) close();
  });
  window.addEventListener("hashchange", close);
  initialized = true;
}

function genId() {
  idSeq += 1;
  return `m-${idSeq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// data: the live Playbook/draft object (null in create-from-Insights until a
// playbook is picked). label: the objective to adjust (adjust mode only).
export function open({ data = null, label = null, mode = "adjust", contextId = null, onChange = null } = {}) {
  init();
  requestOpen(MODAL_ID, close);
  const ctxId = contextId ?? data?.id;
  draft = {
    mode,
    data,
    contextId: ctxId,
    originalLabel: label,
    name: label || "",
    window: { type: "rolling" },
    measures: [],
    onChange,
  };
  if (mode === "adjust" && data && label) {
    const override = data.objectiveMeasures?.[label] || {};
    draft.window = override.window ? { ...override.window } : { type: "rolling" };
    draft.measures = materializeMeasureEntries(label, override).map((e) => ({ ...e }));
    const resolved = resolveObjectives([label], ctxId, data.objectiveMeasures)[0];
    if (!draft.measures.length && resolved?.status === "parked") {
      // A parked objective adjusts its proxy as its one measure.
      draft.measures = [{ id: "proxy", metricId: resolved.proxy.metricId, target: resolved.proxy.target }];
    }
    // Entries are sparse — a target the user never touched lives only in the
    // resolution. Hydrate it so the form shows the standing suggestion (the
    // ARCHIE SUGGESTED badge marks exactly these).
    const resolvedMeasures = resolved?.status === "measured" ? resolved.measures : [];
    draft.measures.forEach((entry) => {
      if (entry.target != null) {
        entry.targetEdited = true;
        return;
      }
      const match = resolvedMeasures.find((m) => m.id === (entry.id || entry.metricId));
      entry.target = match?.target || entry.target;
    });
  }
  catalogFlow = null;
  titleEl.textContent = mode === "create" ? "New objective" : "Adjust objective";
  paint();
  backdrop.hidden = false;
  panel.focus?.();
}

export function close() {
  if (!backdrop || backdrop.hidden) return;
  catalogFlow?.dispose();
  catalogFlow = null;
  draft = null;
  backdrop.hidden = true;
  bodyEl.innerHTML = "";
  footEl.innerHTML = "";
  notifyClose(MODAL_ID);
}

// ── Rendering ────────────────────────────────────────────────────────────────

function paint(opts = {}) {
  if (!draft) return;
  if (catalogFlow) {
    if (opts.preserveSearch) {
      const el = bodyEl.querySelector("[data-objc-search]");
      const pos = el ? el.selectionStart : null;
      bodyEl.innerHTML = catalogFlow.render();
      const next = bodyEl.querySelector("[data-objc-search]");
      if (next && pos != null) {
        next.focus();
        next.setSelectionRange(pos, pos);
      }
    } else {
      bodyEl.innerHTML = catalogFlow.render();
    }
    footEl.innerHTML = "";
    titleEl.textContent = "Add a measure";
    return;
  }
  const nameInput = bodyEl.querySelector("[data-objm-name]");
  if (nameInput) draft.name = nameInput.value;
  titleEl.textContent = draft.mode === "create" ? "New objective" : "Adjust objective";
  bodyEl.innerHTML = renderForm();
  footEl.innerHTML = `
    <button type="button" class="ap-button ghost grey" data-objm-close><span>Cancel</span></button>
    <button type="button" class="ap-button primary orange" data-objm-save${canSave() ? "" : " disabled"}>
      <span>${draft.mode === "create" ? "Create objective" : "Save changes"}</span>
    </button>`;
}

function canSave() {
  return !!draft.name.trim() && !!draft.contextId && draft.measures.length > 0;
}

function renderForm() {
  const playbookPick =
    draft.mode === "create" && !draft.data
      ? `
      <span class="objm__word">for</span>
      ${renderInlineSelect({
        value: draft.contextId || "",
        placeholder: "a Playbook…",
        options: getContexts().map((c) => ({ value: c.id, label: c.name })),
        attr: "data-objm-playbook",
      })}`
      : "";
  return `
    <div class="objm__sentence">
      <span class="objm__word">Grow</span>
      <div class="ap-input-group objm__name">
        <input type="text" data-objm-name value="${esc(draft.name)}" placeholder="what this objective grows…" aria-label="Objective name" />
      </div>
      <span class="objm__word">over a</span>
      ${renderInlineSelect({
        value: draft.window.type,
        options: WINDOWS.map((w) => ({ value: w.id, label: w.label.toLowerCase() })),
        attr: "data-objm-window",
      })}
      ${playbookPick}
    </div>
    ${
      draft.window.type === "fixed"
        ? // Native date input — documented deviation from .ap-datepicker.
          `<div class="ap-form-field objm__date"><label>Ends on</label><div class="ap-input-group"><input type="date" data-objm-date value="${esc(draft.window.date || "")}" /></div></div>`
        : ""
    }
    <span class="objm__seclabel">Measured by</span>
    <div class="objm__measures">
      ${draft.measures.map((entry, i) => renderMeasureCard(entry, i)).join("")}
      <button type="button" class="objm__addcard" data-objm-add-measure>
        <span>+ Add a measure</span>
        <span class="objm__addhint">reach · mentions · clicks · followers · rate…</span>
      </button>
    </div>
    <div class="objm__status">
      <i class="ap-icon-info" aria-hidden="true"></i>
      <span>Status: the objective reads
        <strong class="objm__status--risk">At risk</strong> /
        <strong class="objm__status--watch">Watch</strong> /
        <strong class="objm__status--track">On track</strong>
        from its measures — nothing to configure.</span>
    </div>`;
}

function renderInlineSelect({ value, options, attr, placeholder = "" }) {
  const selected = options.find((o) => o.value === value);
  return `
    <details class="ap-select inline-dropdown objm__select" data-objm-select>
      <summary class="ap-select-trigger">
        <span class="ap-select-value${selected ? "" : " ap-select-placeholder"}">${esc(selected ? selected.label : placeholder)}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown" role="listbox">
        <div class="ap-select-options">
          ${options
            .map(
              (o) => `
              <div class="ap-select-option${o.value === value ? " selected" : ""}" ${attr}="${esc(o.value)}" role="option" aria-selected="${o.value === value}">
                <span class="ap-select-option-text">${esc(o.label)}</span>
                ${o.value === value ? `<i class="ap-icon-check" aria-hidden="true"></i>` : ""}
              </div>`,
            )
            .join("")}
        </div>
      </div>
    </details>`;
}

// One compact measure card — the target input matches the metric's type.
function renderMeasureCard(entry, i) {
  const rate = isRateMetric(entry.metricId);
  const baseline = scopedBaselineFor(entry.metricId, draft.contextId, entry.scope);
  const target = entry.target || "";
  const suggestedPct = pctDelta(baseline, target);
  const scopeText = entry.scope?.network ? scopeLabel(entry.scope) : "All networks";
  const body = rate
    ? `
      <span class="objm__word">hold above</span>
      <div class="ap-input-group objm__target"><input type="text" data-objm-target data-objm-i="${i}" value="${esc(target)}" aria-label="Target" /></div>
      <span class="objm__cardhint">currently ${esc(baseline)} — a rate has no "from", only a bar to clear</span>`
    : `
      <span class="objm__word">from</span>
      <span class="objm__from">${esc(baseline)} <span class="objm__now">now</span></span>
      <span class="objm__word">to</span>
      <div class="ap-input-group objm__target"><input type="text" data-objm-target data-objm-i="${i}" value="${esc(target)}" aria-label="Target" /></div>
      ${entry.target == null && target === "" ? "" : entry.targetEdited ? "" : `<span class="ap-badge orange">Archie suggested${suggestedPct != null ? ` · +${suggestedPct}%` : ""}</span>`}
      ${perDay(baseline, target) ? `<span class="objm__spacer"></span><span class="objm__cardhint">that's ${perDay(baseline, target)}</span>` : ""}`;
  return `
    <div class="objm__card">
      <div class="objm__cardhead">
        <span class="objm__cardname">${esc(metricLabel(entry.metricId))}</span>
        <span class="ap-badge grey">${esc(metricType(entry.metricId).toUpperCase())}</span>
        <span class="objm__spacer"></span>
        <span class="objm__scope">${esc(scopeText)}</span>
        <button type="button" class="ap-icon-button transparent" data-objm-remove="${i}" aria-label="Remove ${esc(metricLabel(entry.metricId))}"><i class="ap-icon-close"></i></button>
      </div>
      <div class="objm__cardbody">${body}</div>
    </div>`;
}

function parseNum(str) {
  if (typeof str !== "string") return null;
  const cleaned = str.replace(/[€$,+\s]/g, "").replace(/%$/, "");
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

function pctDelta(baseline, target) {
  const b = parseNum(baseline);
  const t = parseNum(target);
  if (b == null || t == null || b === 0) return null;
  return Math.round(((t - b) / b) * 100);
}

function perDay(baseline, target) {
  const b = parseNum(baseline);
  const t = parseNum(target);
  if (b == null || t == null || t <= b) return "";
  return `+${Math.max(1, Math.round((t - b) / 30)).toLocaleString("en-US")}/day`;
}

// ── Behavior ─────────────────────────────────────────────────────────────────

// A name that couples pre-fills Archie's suggested measures (targets marked
// suggested); a name that doesn't stays empty and will read coming-soon.
function seedFromName() {
  if (draft.mode !== "create" || draft.measures.length || !draft.name.trim()) return;
  const resolved = resolveObjectives([draft.name.trim()], draft.contextId)[0];
  if (resolved?.status === "measured") {
    draft.measures = resolved.measures.map((m) => ({ id: genId(), metricId: m.metricId, target: m.target }));
  } else if (resolved?.status === "parked") {
    draft.measures = [{ id: genId(), metricId: resolved.proxy.metricId, target: resolved.proxy.target }];
  }
}

function openCatalog() {
  catalogFlow = createCatalogFlow({
    contextId: draft.contextId,
    targetLabel: draft.name.trim() || "this objective",
    onAdd(entry) {
      catalogFlow?.dispose();
      catalogFlow = null;
      draft.measures.push(entry);
      paint();
    },
    onBack() {
      catalogFlow?.dispose();
      catalogFlow = null;
      paint();
    },
    requestRender: (opts) => paint(opts),
  });
  paint();
}

function save() {
  const name = draft.name.trim();
  if (!canSave()) return;
  const data = draft.data || getContexts().find((c) => c.id === draft.contextId);
  if (!data) return;
  if (!Array.isArray(data.objective)) data.objective = [];
  if (!data.objectiveMeasures || typeof data.objectiveMeasures !== "object") data.objectiveMeasures = {};
  const override = {
    measures: draft.measures.map((e) => ({ ...e })),
    window: { ...draft.window },
  };
  if (draft.mode === "create") {
    let finalName = name;
    let n = 2;
    while (data.objective.some((l) => l.toLowerCase() === finalName.toLowerCase())) finalName = `${name} ${n++}`;
    data.objective.push(finalName);
    // A fresh objective earns no verdict yet — it collects.
    override.grace = { day: 1, of: 7 };
    override.origin = "user";
    data.objectiveMeasures[finalName] = override;
  } else {
    const old = draft.originalLabel;
    const idx = data.objective.indexOf(old);
    const prev = data.objectiveMeasures[old] || {};
    if (idx >= 0 && name !== old) {
      data.objective[idx] = name;
      delete data.objectiveMeasures[old];
    }
    data.objectiveMeasures[name] = { ...prev, ...override };
  }
  const cb = draft.onChange;
  const savedCtxId = draft.contextId;
  close();
  cb?.(savedCtxId);
}

function onClick(event) {
  if (!draft) return;
  if (catalogFlow) {
    if (event.target.closest("[data-objm-close]")) {
      close();
      return;
    }
    catalogFlow.handleClick(event);
    return;
  }

  // One open dropdown at a time.
  const inSelect = event.target.closest("[data-objm-select]");
  bodyEl.querySelectorAll("[data-objm-select][open]").forEach((d) => {
    if (d !== inSelect) d.removeAttribute("open");
  });

  if (event.target.closest("[data-objm-close]")) {
    close();
    return;
  }
  if (event.target.closest("[data-objm-save]")) {
    save();
    return;
  }
  const win = event.target.closest("[data-objm-window]");
  if (win) {
    draft.window =
      win.dataset.objmWindow === "fixed" ? { type: "fixed", date: draft.window.date } : { type: "rolling" };
    paint();
    return;
  }
  const pb = event.target.closest("[data-objm-playbook]");
  if (pb) {
    draft.contextId = pb.dataset.objmPlaybook;
    draft.data = getContexts().find((c) => c.id === draft.contextId) || null;
    seedFromName();
    paint();
    return;
  }
  const remove = event.target.closest("[data-objm-remove]");
  if (remove) {
    draft.measures.splice(Number(remove.dataset.objmRemove), 1);
    paint();
    return;
  }
  if (event.target.closest("[data-objm-add-measure]")) {
    if (!draft.contextId) return;
    openCatalog();
  }
}

function onInput(event) {
  if (!draft) return;
  if (catalogFlow) {
    catalogFlow.handleInput(event);
    return;
  }
  const t = event.target;
  if (t.matches("[data-objm-name]")) {
    draft.name = t.value;
    // The sentence resolves live: once the name lands (debounced to the next
    // blur-ish pause via change below would be late — seed on first coupling).
    if (!draft.measures.length && draft.contextId) {
      const before = draft.measures.length;
      seedFromName();
      if (draft.measures.length !== before) paint();
    }
    const saveBtn = footEl.querySelector("[data-objm-save]");
    if (saveBtn) saveBtn.toggleAttribute("disabled", !canSave());
    return;
  }
  if (t.matches("[data-objm-date]")) {
    draft.window = { type: "fixed", date: t.value };
    return;
  }
  if (t.matches("[data-objm-target]")) {
    const entry = draft.measures[Number(t.dataset.objmI)];
    if (entry) {
      entry.target = t.value;
      entry.targetEdited = true;
    }
  }
}
