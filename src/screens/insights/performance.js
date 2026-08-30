import { escapeText, escapeAttr } from "../../utils.js?v=45";
import { getContexts, getContextById, updateContext } from "../../contexts-store.js?v=97";
import { open as openObjectiveEditor } from "../../components/objective-editor-modal.js?v=4";
import { insightsPanelFor, playbookReportFor } from "../../mocks.js?v=117";
import { navigate } from "../../router.js?v=54";
import { showToast } from "../../components/toast.js?v=44";
import { alertState, mutedUntilLabel, reopen, subscribe as subscribeAlerts } from "../../objective-alerts-store.js?v=6";
import {
  performanceRows,
  performanceStrip,
  resolveSelection,
  allClear,
  periodLabel,
  isAtCap,
  scaleVolume,
} from "./insights-model.js?v=7";
import {
  renderRail,
  renderPortfolio,
  renderPortfolioTiles,
  renderGoals,
  renderParkedGoals,
  renderWhatWorked,
  renderBridge,
  renderCapNote,
  renderTrend,
  renderFirstRun,
  figure,
} from "./parts.js?v=17";

// Insights › Performance — the doc's screens 4a and 6a.
//
// ── What this replaced, 2026-08-25 ──────────────────────────────────────────
// A stack: an editorial lead, a Report Studio infobox, a grid of seven health
// cards, the selected Playbook's six widgets, and a thirteen-row objectives table
// with two filter dropdowns. Five blocks answering one question between them, and
// the answer — "which Playbook should I look at" — was the block furthest down.
//
// It is now a master-detail: a ranked rail on the left, the selected Playbook's
// diagnosis on the right. Literally the Topic Feed's list-plus-panel, so the page
// reads as native rather than as a second design. What the table did, the rail's
// second line and the panel's goal rows do between them — and neither of them asks
// the reader to sort anything to find out where to look.
//
// ── The panel has two jobs and one anatomy ──────────────────────────────────
// At risk, Watch and Strong all draw the same panel: head, headline, body, meta,
// goals, three widgets, what worked. Switching Playbooks moves nothing. A Strong
// Playbook gains exactly one block, "What Archie brought here", tinted, and that
// block compares only inside Archie's own 60-day window: its own posts against its
// own previous month. No assembled baselines, because a baseline this page cannot
// see is a claim it cannot defend.

// Which three of the Playbook's six report metrics the panel shows. The doc's
// choice, and the reason is coverage: every network answers impressions,
// engagements and audience, so none of the three can render as a hole.
const PANEL_WIDGET_IDS = ["impressions", "engagements", "audience"];

let selected = null;

export function renderPerformanceTab(period) {
  const contexts = getContexts();
  if (contexts.length === 0) return renderFirstRun("performance");

  const rows = performanceRows();
  const activeId = resolveSelection(rows, selected);
  const active = rows.find((r) => r.id === activeId);
  const single = rows.length === 1;

  return `
    ${renderPortfolioFor(period, rows.length)}
    <div class="insights-split${single ? " insights-split--single" : ""}">
      ${single ? "" : renderRailFor(rows, activeId)}
      <div class="insights-split__panel">
        ${allClear(rows) ? renderAllClear(rows, active) : ""}
        ${active ? renderPanel(active, period) : ""}
      </div>
    </div>`;
}

// The window is stated once, on the row's scope line. It was on every tile too,
// which put it on screen five times counting the topbar's selector — and spent
// 26px of tile height doing it. What stays per-tile is what is only true of that
// tile: reach's coverage, and the goals' fixed monthly window.
function renderPortfolioFor(period, playbooks) {
  const strip = performanceStrip(period);
  const window = periodLabel(period);
  return renderPortfolio({
    label: `All ${playbooks} ${playbooks === 1 ? "Playbook" : "Playbooks"} · ${window}`,
    // Parked objectives stay out of the pace fraction (no target to be on pace
    // against), and tiles strip narratives by design — so the strip's mention
    // of them lives here, in the prose that owns the row's caveats.
    note:
      strip.comingSoon > 0
        ? `${strip.note} · ${strip.comingSoon} objective${strip.comingSoon > 1 ? "s" : ""} coming soon`
        : strip.note,
    tiles: [
      {
        title: "Reach",
        count: strip.reach,
        variation: strip.reachVariation,
        // The coverage caveat rides with the figure it qualifies. In the strip it
        // sat between two figures and read as the start of the next one. It is the
        // only per-tile qualifier left: the window is stated once, on the row.
        narrative: strip.reachPlaybooks < strip.playbooks ? `on ${strip.reachPlaybooks} that measure reach` : "",
      },
      { title: "Posts published", count: strip.posts },
      { title: "Engagement rate", count: strip.engagementRate, unit: "%" },
      // Goals are monthly whatever the selector reads, so this one names its own
      // window instead of inheriting the row's.
      {
        title: "Objectives on pace",
        metric: `${strip.onPace} / ${strip.objectives}`,
        narrative: "measured on 30 days",
      },
    ],
  });
}

// E4 — with one Playbook there is no rail, so it does not render a list of one.
// It comes back on its own at the second Playbook.
//
// ── The verdict, the score and the reason left this rail, 2026-08-29 ────────
// A grade on the Playbook itself ("At risk · 47/100 · reach −9%") read as an
// alarm on the brand — anxiogenic, and aimed at the wrong object: what has a
// target is an OBJECTIVE, and the objectives carry their own verdicts on the
// cards in the panel. The rail's one job now is navigation between Playbooks;
// its meta says how many objectives each carries, which is inventory, not
// judgment. (The worst-first ordering and default selection still come from
// the derived tiers — the page still opens where attention is owed, it just
// doesn't grade anyone for it.)
function renderRailFor(rows, activeId) {
  return renderRail({
    header: `${rows.length} Playbooks`,
    selected: activeId,
    rows: rows.map((r) => {
      const count = r.objectives.length + r.parkedObjectives.length;
      return {
        id: r.id,
        name: r.name,
        meta: `${count} objective${count === 1 ? "" : "s"}`,
      };
    }),
  });
}

// ── The handled journal is gone, 2026-08-25 ────────────────────────────────
// It sat at the foot of this rail: two finished signals ("Reach sliding at Acme —
// recovering", "Noba pricing saves — closed") re-read as a record. The doc asks
// for it, and it is still the right idea somewhere — but not here, and not like
// that. Nothing about it was actionable: it could not be opened, filtered or
// walked back to the chat that closed it, so it was two lines of text occupying
// the one place in the rail a reader looks when they have run out of Playbooks.
// A record you cannot follow is decoration.
//
// Removed with it: renderHandled(), INSIGHTS_HANDLED + insightsHandled() in
// mocks.js, and the .insights-handled* block in insights.css. If it comes back it
// needs a destination per entry, which is a different feature.

// E5 — everything Strong. Said once, above the panel, because a good month should
// read as one: the alternative is seven green rows and a reader wondering what
// they are supposed to do about them.
function renderAllClear(rows, active) {
  return `
    <div class="insights-allclear">
      <p class="insights-allclear__title">Nothing needs your hand this week.</p>
      <p class="insights-allclear__body">
        Every objective across your ${rows.length} Playbooks is on track. The panel opens on your best
        trend — ${escapeText(active?.name || "")} — in proof mode.
      </p>
    </div>`;
}

function renderPanel(row, period) {
  const copy = insightsPanelFor(row.context);
  const objectives = row.objectives;

  // No ring, no score, no Playbook-level verdict in this head — a grade on the
  // brand itself read as an alarm. The panel's subject is the OBJECTIVES: the
  // Playbook is just where they live, so its head is a name and the way out.
  return `
    <article class="ap-card insights-panel" data-insights-panel="${escapeAttr(row.id)}">
      <header class="insights-panel__head">
        <div class="insights-panel__id">
          <h2 class="insights-panel__name">${escapeText(row.name)}</h2>
        </div>
        <a class="ap-link standalone small insights-panel__open" href="#/playbook/${escapeAttr(row.id)}">
          Open the Playbook<i class="ap-icon-arrow-right" aria-hidden="true"></i>
        </a>
      </header>
      ${copy ? `<p class="insights-panel__headline">${escapeText(copy.headline)}</p>` : ""}
      ${copy ? `<p class="insights-panel__body">${escapeText(copy.body)}</p>` : ""}
      ${copy ? `<p class="insights-panel__meta">${escapeText(copy.meta)} · ${escapeText(periodLabel(period))}</p>` : ""}
      ${renderGoals(objectives, row.resolved)}
      ${renderParkedGoals(row.parkedObjectives)}
      ${
        // Creates a fresh objective and opens its editor IN PLACE — a card
        // edits by clicking the card itself, so the footer action only ADDS.
        // Discreet on purpose: ghost grey, the panel's own action treatment.
        `<button type="button" class="ap-button ghost grey insights-goals__adjust" data-insights-add-objective>
           <i class="ap-icon-plus" aria-hidden="true"></i><span>Add objective</span>
         </button>`
      }
      ${renderAlerts(row, objectives)}
      ${renderPanelWidgets(row.context, period)}
      ${renderCapNote(period, { startedOn: "Apr 25" })}
      ${copy?.proof ? renderProof(copy, period) : ""}
      ${renderWhatWorked(copy?.whatWorked, {
        title: copy?.proof ? "The post that made the case" : "What worked here",
      })}
      ${renderPanelBridge(row, copy, period)}
    </article>`;
}

// One metric, one widget, and the widget is a real Report Studio tile driven by the
// same overviewData contract the report uses — layout is ours, the data shape is
// theirs.
//
// Through renderPortfolioTiles, so these three are built by the same function as
// the row above the split rather than by a second path that could drift — but WITH
// their trends, which is that function's one opt-in. They are the panel's
// per-metric evidence, not a row to scan: the headline names one figure's
// direction and the goals rows measure different metrics, so a flat Audience tile
// on an At risk Playbook hid the only number moving the right way.
//
// The window is not restated on them: the verdict line and the meta line above
// already say it twice.
function renderPanelWidgets(context, period) {
  const byId = new Map(playbookReportFor(context).map((w) => [w.id, w]));
  const tiles = PANEL_WIDGET_IDS.map((id) => byId.get(id))
    .filter(Boolean)
    .map((w) => ({ ...w, count: scaleVolume(w.count, period) }));
  return renderPortfolioTiles(tiles, { trends: true });
}

// What the reader already did about an objective, which the numbers cannot say.
// The chat opening shows only what is still asking, so without this line a muted
// objective would have no surface at all — and bringing it back is one click,
// because the reader is the only one who knows they want asking again sooner.
function renderAlerts(row, objectives) {
  const muted = objectives
    .map((o) => ({ objective: o.objective, state: alertState(row.id, o.objective) }))
    .filter((a) => a.state !== "open");
  if (muted.length === 0) return "";

  const items = muted
    .map(
      (a) => `
      <span class="insights-muted__item">
        ${escapeText(a.objective)} —
        ${a.state === "muted" ? `muted ${escapeText(mutedUntilLabel(row.id))}` : "set aside"}
        <button
          type="button"
          class="ap-button transparent blue"
          data-alert-reopen="${escapeAttr(a.objective)}"
          data-alert-playbook="${escapeAttr(row.id)}"
        >
          <span>Bring back</span>
        </button>
      </span>`,
    )
    .join("");

  return `<div class="insights-muted">${items}</div>`;
}

// The one block a Strong Playbook gains. Tinted, so it reads as a different kind of
// claim than the diagnosis above it, and every figure in it compares Archie to
// Archie: its own posts this window against its own previous one.
function renderProof(copy, period) {
  const p = copy.proof;
  const before = scaleVolume(p.reachBefore, period);
  const after = scaleVolume(p.reachAfter, period);
  const posts = scaleVolume(p.posts, period);
  const through = scaleVolume(p.postsThrough, period);
  const total = scaleVolume(p.postsTotal, period);
  const hours = Math.round(((posts * 9) / 60) * 10) / 10;

  return `
    <div class="insights-panel__block insights-proof">
      <div class="insights-proof__head">
        <h3 class="insights-panel__block-title insights-proof__title">What Archie brought here</h3>
        <span class="insights-proof__scope">compared only inside my own window — no extra connections</span>
      </div>
      <div class="insights-proof__grid">
        <div class="insights-proof__card insights-proof__card--wide">
          <span class="insights-proof__label">Reach, vs the ${periodFigure(period)} before</span>
          <span class="insights-proof__bars">
            <span class="insights-proof__bar insights-proof__bar--before" style="width: 62%"></span>
            <span class="insights-proof__bar insights-proof__bar--after" style="width: 74%"></span>
          </span>
          <span class="insights-figure insights-proof__value">
            ${figure(before)} → ${figure(after)} ${renderTrend(p.reachVariation)}
          </span>
          <span class="insights-proof__note">both on my posts · inside my 60-day window</span>
        </div>
        <div class="insights-proof__card">
          <span class="insights-proof__label">Share of publishing</span>
          <span class="insights-figure insights-proof__big">${through} / ${total}</span>
          <span class="insights-proof__note">every post here went through me · ${escapeText(periodLabel(period))}</span>
        </div>
        <div class="insights-proof__card">
          <span class="insights-proof__label">Drafting time saved</span>
          <span class="insights-figure insights-proof__big">~${hours} h</span>
          <span class="insights-proof__note">at 9 min per accepted draft · ${escapeText(periodLabel(period))}</span>
        </div>
      </div>
    </div>`;
}

function periodFigure(period) {
  return periodLabel(period).replace("last ", "");
}

// Conditional, and it names the limit that actually bites here rather than a
// feature list. On a Strong Playbook the boundary is the claim's scope; on a
// struggling one it is the comparison the diagnosis could not make.
function renderPanelBridge(row, copy, period) {
  if (copy?.proof) {
    return renderBridge({
      before: `This proof covers my ${scaleVolume(copy.proof.posts, period)} posts. To claim the whole month —`,
      highlight: "native posts included",
      after: "— build the client report in Report Studio.",
      cta: "Build it in Report Studio",
    });
  }
  if (isAtCap(period)) return "";
  return renderBridge({
    before: "These numbers cover the posts I published here. Comparing them to",
    highlight: "everything else this brand publishes",
    after: "needs the platform — by construction.",
    cta: "Compare in Report Studio",
  });
}

function repaint(root, period) {
  const panel = root.querySelector(".insights-view__panel");
  if (panel) panel.innerHTML = renderPerformanceTab(period);
}

// Returns an unbind function: the shell mounts one tab at a time on a DOM node it
// reuses across navigations, so whoever binds has to hand back a way to remove it
// before the next tab binds on top.
export function bindPerformanceTab(root, period) {
  const onClick = (event) => {
    if (event.target.closest("[data-insights-bridge]")) {
      showToast("Report Studio isn't wired up in this prototype");
      return;
    }
    if (event.target.closest("[data-insights-start-chat]")) {
      navigate("/");
      return;
    }
    // A goal group's name, a parked row, or "Adjust objectives" — opens the
    // shared per-objective editor IN PLACE. The editor mutates the live ctx
    // (see objective-editor-modal); updateContext only notifies, which repaints
    // this tab through the shell's contexts subscription. The body-level modal
    // survives that repaint — it lives outside the tab's root.
    // "Add objective" — creates a fresh objective on the read Playbook and
    // opens its editor in place; naming it IS the first edit.
    if (event.target.closest("[data-insights-add-objective]")) {
      const ctx = getContextById(resolveSelection(performanceRows(), selected));
      if (!ctx) return;
      const labels = Array.isArray(ctx.objective) ? ctx.objective : (ctx.objective = []);
      let name = "New objective";
      let n = 2;
      while (labels.some((l) => l.toLowerCase() === name.toLowerCase())) name = `New objective ${n++}`;
      labels.push(name);
      updateContext(ctx.id, { objective: labels.slice(), updatedAt: "just now" });
      openObjectiveEditor({
        data: ctx,
        label: name,
        onChange: () => updateContext(ctx.id, { updatedAt: "just now" }),
      });
      return;
    }
    const objectiveBtn = event.target.closest("[data-insights-objective]");
    if (objectiveBtn) {
      // Same resolution as the render: `selected` is null until a rail click.
      const ctx = getContextById(resolveSelection(performanceRows(), selected));
      const label = objectiveBtn.dataset.insightsObjective;
      if (ctx && label) {
        openObjectiveEditor({
          data: ctx,
          label,
          onChange: () => updateContext(ctx.id, { updatedAt: "just now" }),
        });
      }
      return;
    }
    // Ahead of the rail handler: this button sits inside the panel, not the rail,
    // but the panel is inside the same delegated root.
    const reopenBtn = event.target.closest("[data-alert-reopen]");
    if (reopenBtn) {
      reopen(reopenBtn.dataset.alertPlaybook, reopenBtn.dataset.alertReopen);
      showToast("Back on the list — you'll see it when you open a chat on this Playbook");
      repaint(root, period);
      return;
    }
    const row = event.target.closest("[data-insights-row]");
    if (row) {
      selected = row.dataset.insightsRow;
      repaint(root, period);
    }
  };

  root.addEventListener("click", onClick);
  const offAlerts = subscribeAlerts(() => repaint(root, period));

  return () => {
    root.removeEventListener("click", onClick);
    offAlerts();
  };
}
