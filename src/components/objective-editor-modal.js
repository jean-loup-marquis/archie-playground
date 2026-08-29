// Per-objective editor — the one place an objective is corrected: rename the
// label, swap/add/remove measures, edit each measure's baseline and target
// (the target arrives PROPOSED — "Suggested" — and the tag falls the moment
// it is edited, per the PP's "propose, never decide"), set the objective's
// window (weekly / monthly / quarterly / ends-on-a-date) that its measures
// inherit and may deviate from, and re-pick a parked objective's proxy.
//
// A real body-level modal shared by the Playbook section AND Insights (which
// opens it in place — no navigation), replacing the portalled editor that
// lived inside playbook-view: there it sat behind the recap's guarded
// onInput/onChange and needed a rename-stash hack; here it owns its DOM and
// listeners, so text fields are tracked normally.
//
// open({ data, label, onChange }): `data` is the LIVE draft/Context object,
// mutated in place — the corrections live in data.objectiveMeasures[label]
// and only store the deviation (see objective-measures.js). `onChange()` fires
// after each mutation; the caller commits/repaints. The label stays the
// objective's identity: a rename (applied on Done) moves the override key and
// re-resolves — and orphans any objective-alerts-store state keyed on the old
// label, an accepted prototype trade-off (see that store's header).

import { escapeHtml as esc } from "../utils.js?v=45";
import { NETWORK_ICON_BY_PLATFORM, NETWORK_LABEL } from "../social-profiles.js?v=85";
import { requestOpen, notifyClose } from "../modal-coordinator.js?v=35";
import { resolveObjectives, metricLabel, baselineFor, FAMILIES, WINDOWS } from "../objective-measures.js?v=3";

const MODAL_ID = "objectiveEditor";

let backdrop = null;
let panel = null;
let bodyEl = null;
let initialized = false;

let data = null; // the live draft/Context object
let label = null; // the open objective's label (identity)
let onChangeCb = null;
let renameDraft = null; // survives structural re-renders

const SHELL = `
<div class="app-modal-backdrop objed__backdrop" id="objedBackdrop" hidden>
  <aside class="ap-dialog objed" id="objedModal" role="dialog" aria-modal="true" aria-label="Objective" tabindex="-1">
    <div class="ap-dialog-header"><span class="ap-dialog-title">Objective</span></div>
    <button type="button" class="ap-dialog-close" data-objed-close aria-label="Close"><i class="ap-icon-close"></i></button>
    <div class="ap-dialog-content objed__content"></div>
    <div class="ap-dialog-footer">
      <div class="ap-dialog-footer-left"></div>
      <div class="ap-dialog-footer-right">
        <button type="button" class="ap-button primary orange" data-objed-close><span>Done</span></button>
      </div>
    </div>
  </aside>
</div>`;

export function init() {
  if (initialized) return;
  const host = document.createElement("div");
  host.innerHTML = SHELL;
  while (host.firstChild) document.body.appendChild(host.firstChild);
  backdrop = document.getElementById("objedBackdrop");
  panel = document.getElementById("objedModal");
  bodyEl = panel.querySelector(".objed__content");

  panel.addEventListener("click", onClick);
  panel.addEventListener("input", onInput);
  panel.addEventListener("change", onChange);
  // Backdrop click closes — but only the backdrop itself: the dialog's own
  // clicks bubble up to it, so a plain listener would close on every click.
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop && !backdrop.hidden) close();
  });
  // A body-level modal survives route changes on its own — close it when the
  // hash moves, or it would sit over the next screen holding a stale `data`.
  // Registered at boot, BEFORE router.start(): on a deep-link navigation this
  // close fires first, then the router renders and the mount reopens cleanly.
  window.addEventListener("hashchange", close);
  initialized = true;
}

export function open(opts) {
  init();
  requestOpen(MODAL_ID, close);
  data = opts.data;
  label = opts.label;
  onChangeCb = opts.onChange || null;
  renameDraft = null;
  // Hiding on close leaves the previous objective's DOM in place — flush it,
  // or render()'s rename re-stash would read the STALE input and this open
  // would display (and Done would apply!) the previous objective's name.
  bodyEl.innerHTML = "";
  render();
  backdrop.hidden = false;
  panel.focus?.();
}

export function close() {
  if (!backdrop || backdrop.hidden) return;
  applyRename();
  backdrop.hidden = true;
  bodyEl.innerHTML = "";
  data = null;
  label = null;
  onChangeCb = null;
  renameDraft = null;
  notifyClose(MODAL_ID);
}

// ── State helpers ──────────────────────────────────────────────────────────

function current() {
  return resolveObjectives([label], data?.id, data?.objectiveMeasures)[0];
}

// The override entry is created on first correction; it only ever stores the
// deviation from the derived defaults.
function overrideFor() {
  if (!data.objectiveMeasures || typeof data.objectiveMeasures !== "object") data.objectiveMeasures = {};
  data.objectiveMeasures[label] = data.objectiveMeasures[label] || {};
  return data.objectiveMeasures[label];
}

function notify() {
  onChangeCb?.();
}

// Applied on Done/close — the label is the identity, so the rename moves the
// override key with it.
function applyRename() {
  const input = bodyEl?.querySelector("[data-objed-rename]");
  const next = ((input ? input.value : renameDraft) || "").trim();
  if (!data || !next || next === label) return;
  const labels = Array.isArray(data.objective) ? data.objective : [];
  const i = labels.indexOf(label);
  if (i < 0) return;
  labels[i] = next;
  if (data.objectiveMeasures?.[label] !== undefined) {
    data.objectiveMeasures[next] = data.objectiveMeasures[label];
    delete data.objectiveMeasures[label];
  }
  label = next;
  notify();
}

// ── Render ─────────────────────────────────────────────────────────────────

// Structural re-render (add/remove/proxy/window changes). Text inputs are
// tracked on `input` and re-injected here, so typing never repaints.
function render() {
  const input = bodyEl.querySelector("[data-objed-rename]");
  if (input) renameDraft = input.value;
  const o = current();
  if (!o) {
    close();
    return;
  }
  bodyEl.innerHTML = renderBody(o);
}

function renderBody(o) {
  const parked = o.status === "parked";
  return `
    ${parked ? `<span class="ap-badge blue objed__soon-badge">Coming soon</span>` : ""}
    <div class="objed__sec">
      <span class="objed__flabel">Objective</span>
      <div class="ap-input-group">
        <input type="text" data-objed-rename value="${esc(renameDraft != null ? renameDraft : label)}" placeholder="What this objective is called" aria-label="Objective name" />
      </div>
    </div>
    <div class="objed__sec objed__sec--row">
      <div class="objed__field">
        <span class="objed__flabel">Window</span>
        <select class="ap-native-select" data-objed-window aria-label="Objective window">
          ${WINDOWS.map(
            (w) => `<option value="${w.id}"${o.window.type === w.id ? " selected" : ""}>${esc(w.label)}</option>`,
          ).join("")}
        </select>
      </div>
      ${
        o.window.type === "deadline"
          ? `<div class="objed__field">
               <span class="objed__flabel">Ends on</span>
               <div class="ap-input-group">
                 <input type="date" data-objed-date value="${esc(o.window.date || "")}" aria-label="End date" />
               </div>
             </div>`
          : ""
      }
    </div>
    ${parked ? renderParkedBlock(o) : renderMeasuredBlock(o)}
  `;
}

function renderMeasuredBlock(o) {
  return `
    <div class="objed__sec">
      <span class="objed__flabel">Measures</span>
      ${o.measures.map((m) => renderMeasure(m, o, { removable: o.measures.length > 1 })).join("")}
      ${renderMetricPicker(o)}
    </div>`;
}

function renderParkedBlock(o) {
  return `
    <div class="objed__sec">
      <span class="objed__flabel">Measure</span>
      <p class="objed__note">${esc(o.soon)} Until it lands, the proxy below stands in.</p>
      ${renderMeasure(o.proxy, o, { proxy: true })}
      ${renderMetricPicker(o, { proxy: true })}
    </div>`;
}

// One measure: bounds (editable baseline + target), the gauge, the per-network
// split, and the measure's own window (inherits the objective's by default —
// deviating is a deliberate act, the beginning of a split).
function renderMeasure(m, o, { removable = false, proxy = false } = {}) {
  const gauge =
    m.progressPct == null
      ? ""
      : `
      <div class="objed__gauge">
        <span class="objed__track"><span class="objed__fill" style="width: ${m.progressPct}%"></span></span>
        <span class="objed__pct">${m.progressPct}% of the way to target</span>
      </div>`;
  const networks = (m.networks || [])
    .map(
      (n) => `
      <span class="objed__net-row">
        <i class="${NETWORK_ICON_BY_PLATFORM[n.platform] || "ap-icon-link"}" aria-hidden="true"></i>
        <span class="objed__net-name">${esc(NETWORK_LABEL[n.platform] || n.platform)}</span>
        <span class="objed__net-baseline">${esc(n.baseline)}</span>
      </span>`,
    )
    .join("");
  const windowValue = m.window.inherited ? "inherit" : m.window.type;
  return `
    <div class="objed__measure">
      <div class="objed__measure-head">
        <span class="objed__measure-name">${esc(m.metricLabel)}</span>
        ${proxy ? `<span class="ap-tag grey mini">Proxy</span>` : ""}
        ${
          removable
            ? `<button type="button" class="objed__measure-remove" data-objed-measure-remove="${m.metricId}" aria-label="Remove ${esc(
                m.metricLabel,
              )}"><i class="ap-icon-close"></i></button>`
            : ""
        }
      </div>
      <div class="objed__bounds">
        <label class="objed__bound">
          <span class="objed__bound-label">From</span>
          <div class="ap-input-group objed__bound-input">
            <input type="text" data-objed-baseline="${m.metricId}" value="${esc(m.baselineValue)}" aria-label="Baseline" />
          </div>
          <span class="objed__bound-note">${esc(m.baselineNote)}</span>
        </label>
        <label class="objed__bound">
          <span class="objed__bound-label">Target</span>
          <div class="ap-input-group objed__bound-input">
            <input type="text" data-objed-target="${m.metricId}" value="${esc(m.target || "")}" aria-label="Target" />
          </div>
          ${m.targetProposed ? `<span class="ap-tag grey mini">Suggested</span>` : ""}
        </label>
      </div>
      ${gauge}
      ${
        networks
          ? `<details class="objed__net">
               <summary>By network</summary>
               <div class="objed__net-rows">${networks}</div>
             </details>`
          : ""
      }
      <div class="objed__measure-window">
        <span class="objed__bound-label">Window</span>
        <select class="ap-native-select" data-objed-measure-window="${m.metricId}" aria-label="Measure window">
          <option value="inherit"${windowValue === "inherit" ? " selected" : ""}>Same as objective</option>
          ${WINDOWS.map(
            (w) => `<option value="${w.id}"${windowValue === w.id ? " selected" : ""}>${esc(w.label)}</option>`,
          ).join("")}
        </select>
        ${
          !m.window.inherited && m.window.type === "deadline"
            ? `<div class="ap-input-group objed__bound-input">
                 <input type="date" data-objed-measure-date="${m.metricId}" value="${esc(m.window.date || "")}" aria-label="Measure end date" />
               </div>`
            : ""
        }
      </div>
    </div>`;
}

// The measure picker — a DS details/summary select grouped by catalogue
// family, each option carrying the metric's default baseline as its caption.
// Inside a .ap-dialog (overflow: hidden) the DS's absolute dropdown gets
// clipped, so HERE the open dropdown flows in place (position: static, see the
// component CSS) and the dialog content scrolls instead.
function renderMetricPicker(o, { proxy = false } = {}) {
  const chosen = new Set(proxy ? [o.proxy.metricId] : o.measures.map((m) => m.metricId));
  const attr = proxy ? "data-objed-proxy-pick" : "data-objed-measure-add";
  const groups = FAMILIES.map(
    (f) => `
      <div class="ap-select-group"><span class="ap-select-group-label">${esc(f.label)}</span></div>
      <div class="ap-select-options">${f.metricIds
        .map((id) => {
          const on = chosen.has(id);
          return `
            <div class="ap-select-option${on ? " selected" : ""}" ${attr}="${id}" role="option" aria-selected="${on}">
              <span class="ap-select-option-content">
                <span class="ap-select-option-title">${esc(metricLabel(id))}</span>
                <span class="ap-select-option-caption">${esc(baselineFor(id, data?.id))}</span>
              </span>
              ${on ? `<i class="ap-icon-check" aria-hidden="true"></i>` : ""}
            </div>`;
        })
        .join("")}</div>`,
  ).join("");
  return `
    <details class="ap-select objed__picker" data-objed-picker>
      <summary class="ap-select-trigger">
        <span class="ap-select-value ap-select-placeholder">${proxy ? "Change the proxy metric…" : "Add a measure…"}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown" role="listbox" aria-label="${proxy ? "Proxy metric" : "Add a measure"}">
        ${groups}
      </div>
    </details>`;
}

// ── Handlers (the component owns its listeners — no host guards) ───────────

function onClick(event) {
  if (!data) return;
  if (event.target.closest("[data-objed-close]")) {
    close();
    return;
  }

  const add = event.target.closest("[data-objed-measure-add]");
  if (add) {
    if (!add.classList.contains("selected")) {
      const id = add.dataset.objedMeasureAdd;
      const ov = overrideFor();
      const ids = ov.metricIds?.length ? ov.metricIds : current().measures.map((m) => m.metricId);
      if (!ids.includes(id)) ov.metricIds = [...ids, id];
      notify();
      render();
    }
    return;
  }

  const remove = event.target.closest("[data-objed-measure-remove]");
  if (remove) {
    const id = remove.dataset.objedMeasureRemove;
    const ov = overrideFor();
    const ids = ov.metricIds?.length ? ov.metricIds : current().measures.map((m) => m.metricId);
    if (ids.length <= 1) return; // an objective keeps at least one measure
    ov.metricIds = ids.filter((x) => x !== id);
    notify();
    render();
    return;
  }

  const proxy = event.target.closest("[data-objed-proxy-pick]");
  if (proxy) {
    overrideFor().proxyId = proxy.dataset.objedProxyPick;
    notify();
    render();
    return;
  }
}

// Text fields write through on every keystroke (the gauge and "Suggested" tag
// refresh on `change` — blur/Enter — so typing never repaints under the caret).
function onInput(event) {
  if (!data) return;
  const t = event.target;
  if (t.matches("[data-objed-rename]")) {
    renameDraft = t.value;
    return;
  }
  if (t.matches("[data-objed-baseline]")) {
    const ov = overrideFor();
    ov.baselines = ov.baselines || {};
    ov.baselines[t.dataset.objedBaseline] = t.value;
    return;
  }
  if (t.matches("[data-objed-target]")) {
    const ov = overrideFor();
    ov.targets = ov.targets || {};
    ov.targets[t.dataset.objedTarget] = t.value;
    return;
  }
  if (t.matches("[data-objed-date]")) {
    const ov = overrideFor();
    ov.window = { type: "deadline", date: t.value };
    return;
  }
  const md = t.closest("[data-objed-measure-date]");
  if (md) {
    const id = md.dataset.objedMeasureDate;
    const ov = overrideFor();
    ov.measureWindows = ov.measureWindows || {};
    ov.measureWindows[id] = { type: "deadline", date: t.value };
  }
}

function onChange(event) {
  if (!data) return;
  const t = event.target;
  if (t.matches("[data-objed-window]")) {
    const ov = overrideFor();
    const prevDate = ov.window?.date;
    ov.window = t.value === "deadline" ? { type: "deadline", date: prevDate } : { type: t.value };
    notify();
    render();
    return;
  }
  const mw = t.closest("[data-objed-measure-window]");
  if (mw) {
    const id = mw.dataset.objedMeasureWindow;
    const ov = overrideFor();
    ov.measureWindows = ov.measureWindows || {};
    if (t.value === "inherit") delete ov.measureWindows[id];
    else {
      const prev = ov.measureWindows[id];
      ov.measureWindows[id] = t.value === "deadline" ? { type: "deadline", date: prev?.date } : { type: t.value };
    }
    notify();
    render();
    return;
  }
  if (
    t.matches("[data-objed-baseline], [data-objed-target], [data-objed-date]") ||
    t.closest("[data-objed-measure-date]")
  ) {
    notify();
    render();
  }
}
