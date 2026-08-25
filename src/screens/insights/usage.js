import { escapeText, escapeAttr } from "../../utils.js?v=45";
import { navigate } from "../../router.js?v=54";
import {
  usageRows,
  usageStrip,
  usagePanelFor,
  resolveSelection,
  periodLabel,
  scaleVolume,
} from "./insights-model.js?v=3";
import {
  renderRail,
  renderPortfolio,
  renderPortfolioTiles,
  renderBridge,
  renderFirstRun,
  figure,
} from "./parts.js?v=11";

// Insights › Usage — the doc's screen 5a.
//
// The master-detail holds here too, and that is the point: same rail, same panel,
// other question. Performance asks "where do I stand", Usage asks "what did Archie
// make" — so the rail is ranked by activity rather than by verdict, and there are
// no health scores anywhere on it. Volume and keep rate are the usage vocabulary.
//
// ── What this replaced, 2026-08-25 ──────────────────────────────────────────
// A portfolio-only page: one lead, one gauge, three counters, two bar charts and
// four voice tiles, none of them attributable to a Playbook. It read as an account
// summary, which meant the one question it is actually for — is Archie worth its
// price, on THIS brand — had no surface. Every figure is per Playbook now, and the
// strip above the rail is the sum of the rail's own rows rather than a figure of
// its own.
//
// The voice moved with it. "The voice Archie learned here" is a per-Playbook fact;
// as a single account-wide "Your voice" it was flattery about the reader, not
// evidence about the product.

let selected = null;

export function renderUsageTab(period) {
  const rows = usageRows(period);
  // E1 — it used to return "", which drew a blank page rather than an answer.
  if (rows.length === 0) return renderFirstRun("usage");

  const activeId = resolveSelection(rows, selected) || rows[0].id;
  const active = rows.find((r) => r.id === activeId) || rows[0];
  const single = rows.length === 1;

  return `
    ${renderPortfolioFor(period, rows.length)}
    <div class="insights-split${single ? " insights-split--single" : ""}">
      ${single ? "" : renderRailFor(rows, activeId, period)}
      <div class="insights-split__panel">${renderPanel(active, period)}</div>
    </div>`;
}

function renderPortfolioFor(period, playbooks) {
  const strip = usageStrip(period);
  const window = periodLabel(period);
  return renderPortfolio({
    label: `All ${playbooks} ${playbooks === 1 ? "Playbook" : "Playbooks"} · ${window}`,
    note: strip.note,
    tiles: [
      { title: "Words written", count: strip.words },
      { title: "Drafts generated", count: strip.drafts },
      { title: "Posts published", count: strip.posts },
      {
        title: "Kept without editing",
        count: strip.keptRate,
        unit: "%",
        narrative: `of ${figure(strip.drafts)} drafts`,
      },
    ],
  });
}

function renderRailFor(rows, activeId, period) {
  return renderRail({
    header: `${rows.length} Playbooks · most active first`,
    selected: activeId,
    // The keep rate takes the meta line here, where Performance puts its verdict:
    // it is the nearest thing this half has to a judgement, and it is the reason
    // one Playbook is worth opening before another.
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      figure: r.posts,
      figureLabel: "posts",
      meta: `<span class="insights-kept${r.keptRate >= 75 ? " is-high" : ""}">${r.keptRate}% kept</span>`,
      note: `${figure(scaleVolume(r.usage.drafts, period))} drafts${r.note ? ` · ${escapeText(r.note)}` : ""}`,
    })),
    footer: `<p class="insights-rail__note">Counts are drafts and posts made with me, ${escapeText(periodLabel(period))}.</p>`,
  });
}

function renderPanel(row, period) {
  const usage = usagePanelFor(row.context, period);
  if (!usage) return "";

  return `
    <article class="ap-card insights-panel" data-insights-panel="${escapeAttr(row.id)}">
      <header class="insights-panel__head">
        <div class="insights-panel__id">
          <h2 class="insights-panel__name">${escapeText(row.name)}</h2>
          <p class="insights-panel__verdict">
            <span class="insights-panel__score">${escapeText(rankNote(row, period))}</span>
          </p>
        </div>
        <a class="ap-link standalone small insights-panel__open" href="#/playbook/${escapeAttr(row.id)}">
          Open the Playbook<i class="ap-icon-arrow-right" aria-hidden="true"></i>
        </a>
      </header>
      <p class="insights-panel__headline">${escapeText(usage.headline)}</p>
      <p class="insights-panel__body">${escapeText(usage.body)}</p>
      <p class="insights-panel__meta">
        on ${figure(usage.drafts)} drafts · ${escapeText(periodLabel(period))} · keep rate against this portfolio's average
      </p>
      ${renderPortfolioTiles(
        [
          { title: "Kept without editing", bodyHtml: keptDial(usage.keptRate) },
          { title: "Drafts generated", count: usage.drafts },
          { title: "Posts published", count: usage.posts },
          { title: "Sources digested", count: usage.sources },
        ],
        { className: "insights-panel__widgets--four" },
      )}
      <div class="insights-panel__pair">
        ${renderNetworks(usage.networks, period)}
        ${renderVoice(usage.voice)}
      </div>
      ${renderBridge({
        before: "Usage counts my own work — nothing here needs comparing outside. Whether it",
        highlight: "performed",
        after: "is the other tab.",
        cta: "Go to Performance",
      })}
    </article>`;
}

function rankNote(row, period) {
  const rows = usageRows(period);
  const rank = rows.findIndex((r) => r.id === row.id);
  if (rank === 0) return `most active Playbook · ${periodLabel(period)}`;
  if (rank === rows.length - 1) return `least active Playbook · ${periodLabel(period)}`;
  return `#${rank + 1} by activity · ${periodLabel(period)}`;
}

// A gauge expresses a part of a whole, so it is reserved for the one rate on this
// panel — putting one on a volume like "640 drafts" would be a visual lie.
//
// Just the dial now — the card around it is the same tile as the other three,
// built by renderPortfolioTiles, so this returns only the shape that goes in the
// middle. It stays hand-drawn rather than becoming the report's half-donut: it is
// the same annulus as the Performance ring, and converting one of the pair without
// the other would break the thing that makes them read as one system.
function keptDial(rate) {
  return `
    <div
      class="insights-gauge__dial"
      style="--gauge-progress: ${rate}"
      role="img"
      aria-label="${rate}% of drafts kept without editing"
    >
      <span class="insights-gauge__value">${escapeText(String(rate))}%</span>
    </div>`;
}

// Where this Playbook's posts went. Bars rather than a chart: three shares of one
// hundred read faster as three lengths than as a plotted series, and the panel
// already carries four cards above them.
function renderNetworks(networks, period) {
  const bars = networks
    .map(
      (n, i) => `
      <div class="insights-bar">
        <span class="insights-bar__label">${escapeText(n.label)}</span>
        <span class="insights-bar__track">
          <span class="insights-bar__fill insights-bar__fill--${i + 1}" style="width: ${n.share}%"></span>
        </span>
        <span class="insights-figure insights-bar__value">${n.share}%</span>
      </div>`,
    )
    .join("");

  return `
    <div class="insights-panel__block">
      <h3 class="insights-panel__block-title">Where it publishes</h3>
      <div class="insights-bars">${bars}</div>
      <p class="insights-panel__footnote">Share of this Playbook's posts, ${escapeText(periodLabel(period))}.</p>
    </div>`;
}

function renderVoice(voice) {
  return `
    <div class="insights-panel__block">
      <h3 class="insights-panel__block-title">The voice I learned here</h3>
      <p class="insights-panel__body insights-voice__body">${escapeText(voice.body)}</p>
      <p class="insights-panel__footnote">learned from your edits and keeps · updated weekly</p>
    </div>`;
}

function repaint(root, period) {
  const panel = root.querySelector(".insights-view__panel");
  if (panel) panel.innerHTML = renderUsageTab(period);
}

export function bindUsageTab(root, period) {
  const onClick = (event) => {
    if (event.target.closest("[data-insights-start-chat]")) {
      navigate("/");
      return;
    }
    if (event.target.closest("[data-insights-bridge]")) {
      navigate("/insights/performance");
      return;
    }
    const row = event.target.closest("[data-insights-row]");
    if (row) {
      selected = row.dataset.insightsRow;
      repaint(root, period);
    }
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}
