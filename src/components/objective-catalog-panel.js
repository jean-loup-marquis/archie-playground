// The metric catalogue and the measure configurator (handoff screens 2c/2d) —
// Archie's own catalogue, exposed to the user: grouped by family, every metric
// typed (volume / rate / counter), the additive ones marked ADDS UP (the only
// ones that unlock "All networks"), the not-yet-available ones listed greyed
// COMING SOON with the proxy Archie would use — the same rule for him and for
// the user. Picking a metric slides the same surface into the configurator:
// scope first (a network acts as a shortcut — it checks its profiles, partial
// deselection allowed), the baseline computes live once the scope is set, and
// Archie's target suggestion lands right behind it. A rate holds a bar
// instead of running from→to.
//
// Two consumers, one flow: `createCatalogFlow()` returns a render/dispatch
// controller the objective modal EMBEDS (the panel is a view of that dialog,
// the design's own "the panel slides"), and `open()` wraps the same flow in a
// standalone body-level dialog for the Playbook block's edit mode.

import { escapeHtml as esc } from "../utils.js?v=45";
import { NETWORK_LABEL, getConnectedProfiles } from "../social-profiles.js?v=85";
import { requestOpen, notifyClose } from "../modal-coordinator.js?v=35";
import {
  catalogEntries,
  metricLabel,
  metricType,
  scopedBaselineFor,
  proposeTargetFrom,
  isRateMetric,
  isAdditiveMetric,
} from "../objective-measures.js?v=6";

const COMPUTE_MS = 900;

let flowSeq = 0;

// ── The shared flow ──────────────────────────────────────────────────────────
// state.view: "catalog" | "config". All interactions are click-driven except
// the search input (the host wires input events to handleInput).
export function createCatalogFlow({ contextId, targetLabel, onAdd, onBack, requestRender }) {
  flowSeq += 1;
  const state = {
    view: "catalog",
    query: "",
    metricId: null,
    network: null, // null = all networks (additive metrics only)
    profileIds: new Set(),
    baselineState: "idle", // idle | computing | ready
    baseline: null,
    target: null,
    windowMode: "inherit", // inherit | custom
    timer: null,
  };

  function profilesFor(network) {
    return getConnectedProfiles().filter((p) => p.platform === network);
  }

  function scope() {
    if (!state.network) return undefined;
    const all = profilesFor(state.network);
    const picked = [...state.profileIds];
    if (!picked.length || picked.length === all.length) return { network: state.network };
    return { network: state.network, profileIds: picked };
  }

  // The baseline computes "live" the moment the scope is posed — never typed
  // before the scope is known. The spinner is the design's own beat.
  function recompute() {
    if (state.timer) window.clearTimeout(state.timer);
    state.baselineState = "computing";
    state.baseline = null;
    state.target = null;
    state.timer = window.setTimeout(() => {
      state.timer = null;
      state.baseline = scopedBaselineFor(state.metricId, contextId, scope());
      state.target = proposeTargetFrom(state.metricId, state.baseline, contextId, scope());
      state.baselineState = "ready";
      requestRender();
    }, COMPUTE_MS);
    requestRender();
  }

  function pickMetric(metricId) {
    state.view = "config";
    state.metricId = metricId;
    // Default scope: first connected network as the shortcut (all its
    // profiles) — "all networks" is a deliberate act, and locked unless the
    // metric truly adds up.
    const first = getConnectedProfiles()[0];
    state.network = first ? first.platform : null;
    state.profileIds = new Set(profilesFor(state.network).map((p) => p.id));
    state.windowMode = "inherit";
    recompute();
  }

  function computingLabel() {
    const all = profilesFor(state.network);
    const first = all.find((p) => state.profileIds.has(p.id)) || all[0];
    return `computing from ${first?.handle || first?.name || "your profiles"}…`;
  }

  function scopeChipLabel(network) {
    const all = profilesFor(network);
    const picked = all.filter((p) => state.profileIds.has(p.id)).length;
    const name = NETWORK_LABEL[network] || network;
    if (state.network === network && picked && picked < all.length) return `${name} · ${picked}/${all.length} profiles`;
    return name;
  }

  // ── Views ──────────────────────────────────────────────────────────────

  function renderCatalog() {
    const q = state.query.trim().toLowerCase();
    const groups = catalogEntries()
      .map((family) => {
        const metrics = family.metrics.filter((m) => !q || m.label.toLowerCase().includes(q));
        if (!metrics.length) return "";
        const rows = metrics
          .map((m) => {
            if (!m.available) {
              return `
                <div class="objc__row objc__row--soon">
                  <span class="objc__row-line">
                    <span class="objc__row-name">${esc(m.label)}</span>
                    <span class="ap-badge yellow">Coming soon</span>
                    <span class="objc__spacer"></span>
                    <button type="button" class="ap-link standalone small" data-objc-proxy-pick="${m.proxyId}">Use the proxy</button>
                  </span>
                  <span class="objc__row-sub">Archie would use <strong>${esc(m.proxyLabel.toLowerCase())}</strong> as a proxy meanwhile — it upgrades automatically when the metric ships.</span>
                </div>`;
            }
            return `
              <button type="button" class="objc__row" data-objc-pick="${m.id}">
                <span class="objc__row-name">${esc(m.label)}</span>
                <span class="ap-badge grey">${m.type.toUpperCase()}</span>
                ${m.additive ? `<span class="ap-badge green">Adds up</span>` : ""}
              </button>`;
          })
          .join("");
        return `<div class="objc__group"><span class="objc__group-label">${esc(family.familyLabel)}</span>${rows}</div>`;
      })
      .join("");
    return `
      <div class="objc__search">
        <div class="ap-input-group">
          <i class="ap-icon-search" aria-hidden="true"></i>
          <input type="text" data-objc-search value="${esc(state.query)}" placeholder="Search the metric catalog…" aria-label="Search the metric catalog" />
        </div>
      </div>
      <div class="objc__body">${groups || `<p class="objc__empty">Nothing in the catalog matches "${esc(state.query)}".</p>`}</div>`;
  }

  function renderConfig() {
    const m = state.metricId;
    const rate = isRateMetric(m);
    const additive = isAdditiveMetric(m);
    const networks = [];
    getConnectedProfiles().forEach((p) => {
      if (!networks.includes(p.platform)) networks.push(p.platform);
    });
    const networkChips = networks
      .map(
        (n) => `
        <button type="button" class="ap-filter-chip" aria-pressed="${state.network === n}" data-objc-network="${n}">
          <span>${esc(scopeChipLabel(n))}</span>
        </button>`,
      )
      .join("");
    const allChip = additive
      ? `<button type="button" class="ap-filter-chip" aria-pressed="${state.network === null}" data-objc-network="all"><span>All networks</span></button>`
      : `<span class="ap-filter-chip objc__chip--locked" aria-disabled="true"><i class="ap-icon-feature-lock" aria-hidden="true"></i><span>All networks</span></span>`;
    const profileChips = state.network
      ? profilesFor(state.network)
          .map(
            (p) => `
            <button type="button" class="ap-filter-chip" aria-pressed="${state.profileIds.has(p.id)}" data-objc-profile="${esc(p.id)}">
              <span>${esc(p.handle || p.name)}</span>
            </button>`,
          )
          .join("")
      : `<span class="objc__hint">Every connected profile — the metric adds up across networks.</span>`;
    const baseline =
      state.baselineState === "computing"
        ? `<span class="objc__computing"><span class="ap-loader blue size-16" aria-hidden="true"><svg><circle></circle><circle></circle></svg></span><span>${esc(computingLabel())}</span></span>`
        : `<span class="objc__value">${esc(state.baseline || "—")}</span>`;
    const target =
      state.baselineState === "ready"
        ? `<span class="objc__value">${esc(state.target || "—")}</span><span class="ap-badge orange">Archie suggested</span>`
        : `<span class="objc__value objc__value--empty">—</span><span class="objc__hint">Archie suggests a target the moment the baseline lands</span>`;
    return `
      <div class="objc__confighead">
        <button type="button" class="ap-link standalone small" data-objc-back><i class="ap-icon-chevron-left" aria-hidden="true"></i>Catalog</button>
        <span class="objc__configtitle">${esc(metricLabel(m))}</span>
        <span class="ap-badge grey">${esc(metricType(m).toUpperCase())}</span>
        <span class="objc__spacer"></span>
        <span class="objc__hint">from the metric catalog</span>
      </div>
      <div class="objc__configbody">
        <div class="objc__cfgrow">
          <span class="objc__cfglabel">Measure on</span>
          <span class="objc__chips">${networkChips}${allChip}</span>
        </div>
        <p class="objc__hint objc__hint--indent">Picking a network selects its profiles — uncheck below to narrow. "All networks" only unlocks for metrics that truly add up, like followers.</p>
        ${
          state.network
            ? `<div class="objc__cfgrow"><span class="objc__cfglabel">Profiles</span><span class="objc__chips">${profileChips}</span></div>`
            : ""
        }
        <div class="objc__cfgrow"><span class="objc__cfglabel">Baseline</span>${baseline}</div>
        <div class="objc__cfgrow"><span class="objc__cfglabel">Target</span><span class="objc__chips">${target}</span></div>
        <div class="objc__cfgrow">
          <span class="objc__cfglabel">Window</span>
          <span class="objc__chips">
            <button type="button" class="ap-filter-chip" aria-pressed="${state.windowMode === "inherit"}" data-objc-window="inherit"><span>Same as objective</span></button>
            <button type="button" class="ap-filter-chip" aria-pressed="${state.windowMode === "custom"}" data-objc-window="custom"><span>Rolling 30-day window</span></button>
          </span>
        </div>
        <div class="objc__note">
          <i class="ap-icon-info" aria-hidden="true"></i>
          <span>${
            rate
              ? `A rate has no "from" — the target is a bar to hold: <strong>hold above ${esc(state.target || "the suggestion")}</strong>.`
              : `A volume measure reads as progress toward the target. If you'd picked a rate — engagement rate, say — the target line would become <strong>hold above 3.5%</strong> instead.`
          }</span>
        </div>
      </div>
      <div class="objc__configfoot">
        <button type="button" class="ap-button ghost grey" data-objc-cancel><span>Cancel</span></button>
        <button type="button" class="ap-button primary orange" data-objc-add${state.baselineState !== "ready" ? " disabled" : ""}>
          <span>Add to ${esc(targetLabel || "the objective")}</span>
        </button>
      </div>`;
  }

  return {
    state,
    render() {
      return state.view === "catalog" ? renderCatalog() : renderConfig();
    },
    // Returns true when the event was consumed by the flow.
    handleClick(event) {
      const pick = event.target.closest("[data-objc-pick]");
      if (pick) {
        pickMetric(pick.dataset.objcPick);
        return true;
      }
      const proxyPick = event.target.closest("[data-objc-proxy-pick]");
      if (proxyPick) {
        pickMetric(proxyPick.dataset.objcProxyPick);
        return true;
      }
      if (event.target.closest("[data-objc-back]")) {
        if (state.timer) window.clearTimeout(state.timer);
        state.view = "catalog";
        requestRender();
        return true;
      }
      const net = event.target.closest("[data-objc-network]");
      if (net) {
        const n = net.dataset.objcNetwork;
        state.network = n === "all" ? null : n;
        state.profileIds = new Set(state.network ? profilesFor(state.network).map((p) => p.id) : []);
        recompute();
        return true;
      }
      const prof = event.target.closest("[data-objc-profile]");
      if (prof) {
        const id = prof.dataset.objcProfile;
        if (state.profileIds.has(id)) state.profileIds.delete(id);
        else state.profileIds.add(id);
        if (!state.profileIds.size) state.profileIds = new Set(profilesFor(state.network).map((p) => p.id));
        recompute();
        return true;
      }
      const win = event.target.closest("[data-objc-window]");
      if (win) {
        state.windowMode = win.dataset.objcWindow;
        requestRender();
        return true;
      }
      if (event.target.closest("[data-objc-add]")) {
        if (state.baselineState !== "ready") return true;
        onAdd({
          id: `m-${flowSeq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          metricId: state.metricId,
          scope: scope(),
          target: state.target || undefined,
          window: state.windowMode === "custom" ? { type: "rolling" } : undefined,
        });
        return true;
      }
      if (event.target.closest("[data-objc-cancel]")) {
        onBack?.();
        return true;
      }
      return false;
    },
    handleInput(event) {
      const search = event.target.closest("[data-objc-search]");
      if (!search) return false;
      state.query = search.value;
      requestRender({ preserveSearch: true });
      return true;
    },
    dispose() {
      if (state.timer) window.clearTimeout(state.timer);
    },
  };
}

// ── Standalone wrapper (Playbook block edit mode) ────────────────────────────

const MODAL_ID = "objectiveCatalog";

let backdrop = null;
let panel = null;
let bodyEl = null;
let titleEl = null;
let initialized = false;
let flow = null;
let onDone = null;

const SHELL = `
<div class="app-modal-backdrop objc__backdrop" id="objcBackdrop" hidden>
  <aside class="ap-dialog objc" id="objcModal" role="dialog" aria-modal="true" aria-label="Metric catalog" tabindex="-1">
    <div class="ap-dialog-header"><span class="ap-dialog-title" id="objcTitle">Add a measure</span></div>
    <button type="button" class="ap-dialog-close" data-objc-close aria-label="Close"><i class="ap-icon-close"></i></button>
    <div class="ap-dialog-content objc__content"></div>
  </aside>
</div>`;

export function init() {
  if (initialized) return;
  const host = document.createElement("div");
  host.innerHTML = SHELL;
  while (host.firstChild) document.body.appendChild(host.firstChild);
  backdrop = document.getElementById("objcBackdrop");
  panel = document.getElementById("objcModal");
  bodyEl = panel.querySelector(".objc__content");
  titleEl = document.getElementById("objcTitle");

  panel.addEventListener("click", (e) => {
    if (e.target.closest("[data-objc-close]")) {
      close();
      return;
    }
    flow?.handleClick(e);
  });
  panel.addEventListener("input", (e) => flow?.handleInput(e));
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop && !backdrop.hidden) close();
  });
  window.addEventListener("hashchange", close);
  initialized = true;
}

function paint(opts = {}) {
  if (!flow) return;
  if (opts.preserveSearch) {
    const el = bodyEl.querySelector("[data-objc-search]");
    const pos = el ? el.selectionStart : null;
    bodyEl.innerHTML = flow.render();
    const next = bodyEl.querySelector("[data-objc-search]");
    if (next && pos != null) {
      next.focus();
      next.setSelectionRange(pos, pos);
    }
    return;
  }
  bodyEl.innerHTML = flow.render();
}

export function open({ contextId, targetLabel, onAdd }) {
  init();
  requestOpen(MODAL_ID, close);
  onDone = onAdd;
  flow = createCatalogFlow({
    contextId,
    targetLabel,
    onAdd: (entry) => {
      const cb = onDone;
      close();
      cb?.(entry);
    },
    onBack: close,
    requestRender: paint,
  });
  titleEl.textContent = "Add a measure";
  bodyEl.innerHTML = flow.render();
  backdrop.hidden = false;
  panel.focus?.();
}

export function close() {
  if (!backdrop || backdrop.hidden) return;
  flow?.dispose();
  flow = null;
  onDone = null;
  backdrop.hidden = true;
  bodyEl.innerHTML = "";
  notifyClose(MODAL_ID);
}
