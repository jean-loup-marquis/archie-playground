// Per-objective editor — the one place an objective is corrected: rename the
// label, add/remove measures (the same metric may appear twice with two
// scopes), scope a measure to a network or to specific profiles of one
// network, edit each measure's baseline and target (the target arrives
// PROPOSED — "Suggested" — and the tag falls the moment it is edited, per the
// PP's "propose, never decide"), set the objective's window (rolling / ends
// on a date) that its measures inherit and may deviate from, and re-pick a
// parked objective's proxy.
//
// A real body-level modal shared by the Playbook section AND Insights (which
// opens it in place — no navigation). Every dropdown in here is the DS
// .ap-select composition with the `inline-dropdown` variant (ds-patches.css):
// no native <select> popup (OS-styled, it reads foreign in the dialog), and
// nothing for .ap-dialog's overflow:hidden to clip — the content scrolls.
//
// open({ data, label, onChange }): `data` is the LIVE draft/Context object,
// mutated in place — the corrections live in data.objectiveMeasures[label]
// (see objective-measures.js for the shape). `onChange()` fires after each
// mutation; the caller commits/repaints. The label stays the objective's
// identity: a rename (applied on Done) moves the override key and re-resolves
// — and orphans any objective-alerts-store state keyed on the old label, an
// accepted prototype trade-off (see that store's header).

import { escapeHtml as esc } from "../utils.js?v=45";
import { NETWORK_LABEL, getConnectedProfiles } from "../social-profiles.js?v=85";
import { requestOpen, notifyClose } from "../modal-coordinator.js?v=35";
import {
  resolveObjectives,
  materializeMeasureEntries,
  metricLabel,
  baselineFor,
  FAMILIES,
  WINDOWS,
} from "../objective-measures.js?v=6";

const MODAL_ID = "objectiveEditor";

let backdrop = null;
let panel = null;
let bodyEl = null;
let initialized = false;
let idSeq = 0;

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

// Duplicates (Reach on LinkedIn + Reach on Instagram) make the measure list
// positional — it materializes on the first structural correction, from the
// stored entries or the coupling's defaults.
function ensureMeasures() {
  const ov = overrideFor();
  if (!Array.isArray(ov.measures)) ov.measures = materializeMeasureEntries(label, ov);
  return ov.measures;
}

function updateEntry(mid, fn) {
  const entry = ensureMeasures().find((e) => (e.id || e.metricId) === mid);
  if (!entry) return;
  fn(entry);
  notify();
  render();
}

function genId() {
  idSeq += 1;
  return `m-${idSeq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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

// Structural re-render (add/remove/scope/proxy/window changes). Text inputs
// are tracked on `input` and re-injected here, so typing never repaints.
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
    <div class="ap-form-field">
      <label>Objective</label>
      <div class="ap-input-group">
        <input type="text" data-objed-rename value="${esc(renameDraft != null ? renameDraft : label)}" placeholder="What this objective is called" />
      </div>
    </div>
    <div class="objed__sec--row">
      <div class="ap-form-field objed__field">
        <label>Window</label>
        ${renderDsSelect({
          value: o.window.type,
          options: WINDOWS.map((w) => ({ value: w.id, label: w.label })),
          attr: "data-objed-owin-pick",
          ariaLabel: "Objective window",
        })}
      </div>
      ${
        o.window.type === "fixed"
          ? // Native date input, a documented deviation: the DS says .ap-datepicker
            // for dates, but composing its full calendar buys nothing in a proto —
            // the field keeps the DS form-field structure so the swap is local.
            `<div class="ap-form-field objed__field">
               <label>Ends on</label>
               <div class="ap-input-group">
                 <input type="date" data-objed-date value="${esc(o.window.date || "")}" />
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
      <span class="objed__seclabel">Measures</span>
      ${o.measures.map((m) => renderMeasure(m, o, { removable: o.measures.length > 1 })).join("")}
      ${renderMetricPicker(o)}
    </div>`;
}

function renderParkedBlock(o) {
  return `
    <div class="objed__sec">
      <span class="objed__seclabel">Measure</span>
      <p class="objed__note">${esc(o.soon)} Until it lands, the proxy below stands in.</p>
      ${renderMeasure(o.proxy, o, { proxy: true })}
      ${renderMetricPicker(o, { proxy: true })}
    </div>`;
}

// A DS select (details/summary + option rows) whose dropdown flows in place —
// the `inline-dropdown` ds-patches variant. Options act on CLICK and carry
// the pick attribute + the owning measure's id.
function renderDsSelect({ value, options, attr, mid = "", ariaLabel, placeholder = "" }) {
  const selected = options.find((opt) => opt.value === value);
  return `
    <details class="ap-select inline-dropdown" data-objed-select>
      <summary class="ap-select-trigger">
        <span class="ap-select-value${selected ? "" : " ap-select-placeholder"}">${esc(selected ? selected.label : placeholder)}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown" role="listbox" aria-label="${esc(ariaLabel)}">
        <div class="ap-select-options">
          ${options
            .map(
              (opt) => `
              <div class="ap-select-option${opt.value === value ? " selected" : ""}" ${attr}="${esc(opt.value)}"${
                mid ? ` data-objed-mid="${esc(mid)}"` : ""
              } role="option" aria-selected="${opt.value === value}">
                <span class="ap-select-option-text">${esc(opt.label)}</span>
                ${opt.value === value ? `<i class="ap-icon-check" aria-hidden="true"></i>` : ""}
              </div>`,
            )
            .join("")}
        </div>
      </div>
    </details>`;
}

// The networks a measure can be scoped to — the ones with connected profiles.
function connectedNetworks() {
  const seen = [];
  getConnectedProfiles().forEach((p) => {
    if (!seen.includes(p.platform)) seen.push(p.platform);
  });
  return seen;
}

// One measure: bounds (editable baseline with its provenance one hover away,
// editable target), the gauge, the scope (a network, then optionally specific
// profiles of it), and the measure's own window (inherits the objective's by
// default — deviating is a deliberate act, the beginning of a split).
function renderMeasure(m, o, { removable = false, proxy = false } = {}) {
  const mid = m.id;
  const gauge =
    m.progressPct == null
      ? ""
      : `
      <div class="objed__gauge">
        <span class="objed__track"><span class="objed__fill" style="width: ${m.progressPct}%"></span></span>
        <span class="objed__pct">${m.progressPct}% of the way to target</span>
      </div>`;
  const network = m.scope?.network || "all";
  const scopeBlock = proxy
    ? ""
    : `
      <div class="ap-form-field objed__bound objed__scope">
        <label>On</label>
        ${renderDsSelect({
          value: network,
          options: [
            { value: "all", label: "All networks" },
            ...connectedNetworks().map((n) => ({ value: n, label: NETWORK_LABEL[n] || n })),
          ],
          attr: "data-objed-net-pick",
          mid,
          ariaLabel: "Measure scope",
        })}
      </div>
      ${network !== "all" ? renderProfilePicker(m, mid) : ""}`;
  const windowValue = m.window.inherited ? "inherit" : m.window.type;
  return `
    <div class="objed__measure">
      <div class="objed__measure-head">
        <span class="objed__measure-name">${esc(m.metricLabel)}${
          m.scopeLabel ? `<span class="objed__measure-scope"> · ${esc(m.scopeLabel)}</span>` : ""
        }</span>
        ${proxy ? `<span class="ap-badge blue">Proxy</span>` : ""}
        ${
          removable
            ? `<button type="button" class="ap-icon-button transparent" data-objed-measure-remove="${esc(mid)}" aria-label="Remove ${esc(
                m.metricLabel,
              )}"><i class="ap-icon-close"></i></button>`
            : ""
        }
      </div>
      <div class="objed__bounds">
        <div class="ap-form-field objed__bound">
          <label>From</label>
          <div class="ap-input-group">
            <input type="text" data-objed-baseline data-objed-mid="${esc(mid)}" value="${esc(m.baselineValue || "")}" aria-label="Baseline" />
          </div>
          <span class="objed__hint">
            <i class="ap-icon-info" aria-hidden="true" role="img" aria-label="${esc(m.baselineHint)}"></i>
            <span class="ap-tooltip top objed__hint-tip" aria-hidden="true">${esc(m.baselineHint)}</span>
          </span>
        </div>
        <div class="ap-form-field objed__bound">
          <label>Target</label>
          <div class="ap-input-group">
            <input type="text" data-objed-target data-objed-mid="${esc(mid)}" value="${esc(m.target || "")}" aria-label="Target" />
          </div>
          ${m.targetProposed ? `<span class="ap-badge blue">Suggested</span>` : ""}
        </div>
      </div>
      ${gauge}
      ${scopeBlock}
      <div class="ap-form-field objed__bound objed__measure-window">
        <label>Window</label>
        ${renderDsSelect({
          value: windowValue,
          options: [
            { value: "inherit", label: "Same as objective" },
            ...WINDOWS.map((w) => ({ value: w.id, label: w.label })),
          ],
          attr: "data-objed-mwin-pick",
          mid,
          ariaLabel: "Measure window",
        })}
        ${
          !m.window.inherited && m.window.type === "fixed"
            ? `<div class="ap-input-group">
                 <input type="date" data-objed-mdate data-objed-mid="${esc(mid)}" value="${esc(m.window.date || "")}" aria-label="Measure end date" />
               </div>`
            : ""
        }
      </div>
    </div>`;
}

// Narrowing to specific profiles of the picked network — checkboxes, none
// checked = the whole network.
function renderProfilePicker(m, mid) {
  const profiles = getConnectedProfiles().filter((p) => p.platform === m.scope.network);
  if (!profiles.length) return "";
  const picked = new Set(m.scope.profileIds || []);
  return `
    <div class="objed__profiles">
      ${profiles
        .map(
          (p) => `
          <label class="ap-checkbox-container">
            <input type="checkbox" data-objed-profile="${esc(p.id)}" data-objed-mid="${esc(mid)}"${picked.has(p.id) ? " checked" : ""} />
            <i></i>
            <span>${esc(p.name || p.handle)}</span>
          </label>`,
        )
        .join("")}
    </div>`;
}

// The measure picker — a DS details/summary select grouped by catalogue
// family, each option carrying the metric's default baseline as its caption.
// Adding never dedupes: the same metric twice with two scopes is two measures.
function renderMetricPicker(o, { proxy = false } = {}) {
  const proxyId = proxy ? o.proxy.metricId : null;
  const attr = proxy ? "data-objed-proxy-pick" : "data-objed-measure-add";
  const groups = FAMILIES.map(
    (f) => `
      <div class="ap-select-group"><span class="ap-select-group-label">${esc(f.label)}</span></div>
      <div class="ap-select-options">${f.metricIds
        .map((id) => {
          const on = proxy && id === proxyId;
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
    <details class="ap-select inline-dropdown objed__picker" data-objed-select>
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

  // One open dropdown at a time — close any DS select the click lands outside.
  const inSelect = event.target.closest("[data-objed-select]");
  bodyEl.querySelectorAll("[data-objed-select][open]").forEach((d) => {
    if (d !== inSelect) d.removeAttribute("open");
  });

  if (event.target.closest("[data-objed-close]")) {
    close();
    return;
  }

  const add = event.target.closest("[data-objed-measure-add]");
  if (add) {
    ensureMeasures().push({ id: genId(), metricId: add.dataset.objedMeasureAdd });
    notify();
    render();
    return;
  }

  const remove = event.target.closest("[data-objed-measure-remove]");
  if (remove) {
    const measures = ensureMeasures();
    if (measures.length <= 1) return; // an objective keeps at least one measure
    const mid = remove.dataset.objedMeasureRemove;
    overrideFor().measures = measures.filter((e) => (e.id || e.metricId) !== mid);
    notify();
    render();
    return;
  }

  const proxyPick = event.target.closest("[data-objed-proxy-pick]");
  if (proxyPick) {
    // A new proxy metric resets the proxy's bounds — the old baseline/target
    // described another metric.
    overrideFor().proxy = { metricId: proxyPick.dataset.objedProxyPick };
    notify();
    render();
    return;
  }

  const owin = event.target.closest("[data-objed-owin-pick]");
  if (owin) {
    const ov = overrideFor();
    const prevDate = ov.window?.date;
    const type = owin.dataset.objedOwinPick;
    ov.window = type === "fixed" ? { type: "fixed", date: prevDate } : { type: "rolling" };
    notify();
    render();
    return;
  }

  const mwin = event.target.closest("[data-objed-mwin-pick]");
  if (mwin) {
    const type = mwin.dataset.objedMwinPick;
    updateEntry(mwin.dataset.objedMid, (entry) => {
      if (type === "inherit") delete entry.window;
      else entry.window = type === "fixed" ? { type: "fixed", date: entry.window?.date } : { type: "rolling" };
    });
    return;
  }

  const net = event.target.closest("[data-objed-net-pick]");
  if (net) {
    const network = net.dataset.objedNetPick;
    updateEntry(net.dataset.objedMid, (entry) => {
      if (network === "all") delete entry.scope;
      else entry.scope = { network };
      // The suggested bounds follow the scope — a kept baseline would describe
      // the previous scope's world.
      delete entry.baseline;
      delete entry.target;
    });
    return;
  }
}

// Text fields write through on every keystroke (the gauge and "Suggested"
// badge refresh on `change` — blur/Enter — so typing never repaints under the
// caret).
function onInput(event) {
  if (!data) return;
  const t = event.target;
  if (t.matches("[data-objed-rename]")) {
    renameDraft = t.value;
    return;
  }
  const mid = t.dataset.objedMid;
  if (t.matches("[data-objed-baseline]")) {
    writeMeasureField(mid, "baseline", t.value);
    return;
  }
  if (t.matches("[data-objed-target]")) {
    writeMeasureField(mid, "target", t.value);
    return;
  }
  if (t.matches("[data-objed-date]")) {
    const ov = overrideFor();
    ov.window = { type: "fixed", date: t.value };
    return;
  }
  if (t.matches("[data-objed-mdate]")) {
    const entry = ensureMeasures().find((e) => (e.id || e.metricId) === mid);
    if (entry) entry.window = { type: "fixed", date: t.value };
  }
}

// The proxy's bounds live on override.proxy; a measure's on its entry.
function writeMeasureField(mid, field, value) {
  if (mid === "proxy") {
    const ov = overrideFor();
    ov.proxy = { metricId: current().proxy.metricId, ...ov.proxy, [field]: value };
    return;
  }
  const entry = ensureMeasures().find((e) => (e.id || e.metricId) === mid);
  if (entry) entry[field] = value;
}

function onChange(event) {
  if (!data) return;
  const t = event.target;
  const profile = t.closest("[data-objed-profile]");
  if (profile) {
    updateEntry(profile.dataset.objedMid, (entry) => {
      if (!entry.scope?.network) return;
      const ids = new Set(entry.scope.profileIds || []);
      if (t.checked) ids.add(profile.dataset.objedProfile);
      else ids.delete(profile.dataset.objedProfile);
      entry.scope.profileIds = [...ids];
      if (!entry.scope.profileIds.length) delete entry.scope.profileIds;
      // The suggested bounds follow the scope.
      delete entry.baseline;
      delete entry.target;
    });
    return;
  }
  if (t.matches("[data-objed-baseline], [data-objed-target], [data-objed-date], [data-objed-mdate]")) {
    notify();
    render();
  }
}
