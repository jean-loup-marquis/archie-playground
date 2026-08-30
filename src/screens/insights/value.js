import { escapeText } from "../../utils.js?v=45";
import { showToast } from "../../components/toast.js?v=44";
import { navigate } from "../../router.js?v=54";
import { valueLedger, winningPosts, periodLabel } from "./insights-model.js?v=7";
import { renderPortfolioTiles, renderTrend, renderFirstRun, figure } from "./parts.js?v=18";

// Insights › Value — the doc's screen 6b, and a tab this app did not have.
//
// Performance answers "where do I stand". Usage answers "what did Archie make".
// Neither answers the one a renewal conversation actually opens with — is this
// worth its price — and that question was being served by whichever of the two
// happened to look best, which is how a page starts flattering.
//
// So it gets its own room, portfolio-wide, and one rule that makes it defensible:
// it claims ONLY what improved. The goals it lists are the ones whose own trend is
// positive; the ones still behind are COUNTED here and read on Performance. A tab
// that argued both sides would be a report, and the report is Report Studio's job.
//
// No rail. The renewal question is not asked per brand — it is asked about the
// account, and a rail here would invite the reader to find the one brand that
// happens to prove it.
//
// ── Two figures were fixed on the way in, 2026-08-25 ────────────────────────
// The doc's ledger claimed ~14 h of drafting saved and +21% on Agorapulse's lead
// goal. Its own Alliance panel does the time arithmetic at 9 min per accepted post
// (16 posts → ~2.5 h), which puts 318 posts at ~48 h, and the Performance tab
// measures that lead goal at +8%. Both are derived now — see insights-model.js —
// so this tab cannot claim a number the tab beside it contradicts.

export function renderValueTab(period) {
  const ledger = valueLedger(period);
  const posts = winningPosts();
  // E1 — never a ledger of noughts. Every figure here is a claim, and a claim of
  // zero reach printed beside an authored "19 signals turned into work" is worse
  // than no tab at all.
  if (ledger.posts === 0) return renderFirstRun("value");

  return `
    <div class="insights-value">
      ${renderHeader(ledger, period)}
      ${renderLedger(ledger)}
      ${renderGoals(ledger, period)}
      ${renderPosts(posts, period)}
      ${renderBoundary()}
    </div>`;
}

function renderHeader(ledger, period) {
  const hours = Math.round(ledger.hoursSaved);
  return `
    <header class="insights-value__head">
      <h2 class="insights-value__eyebrow">
        What I brought you
        <span class="insights-value__scope">
          ${escapeText(periodLabel(period))} · every Playbook · numbers you can check
        </span>
      </h2>
      <p class="insights-value__lead">
        Renewal is a fair question. The answer over the ${escapeText(periodLabel(period))}:
        <strong>${figure(ledger.reach)} people reached</strong>, roughly ${hours} hours of drafting you didn't do,
        and ${ledger.signalsActed} signals turned into work.
      </p>
      <!-- The two assumptions the tiles' footnotes used to carry. They belong in one
           line under the claim they qualify, not scattered one per card. -->
      <p class="insights-value__assumptions">
        Reach is summed from ${ledger.reachPlaybooks} Playbooks' reach goals; time saved counts 9 minutes per
        accepted post.
      </p>
    </header>`;
}

// Four figures, and every one of them is either summed from the rails behind it or
// derived from the page's single piece of arithmetic. None is authored here.
//
// ── The same tiles as the other two tabs, 2026-08-25 ───────────────────────
// These were four hand-made `.ap-card`s with 26px values and a footnote line each:
// the same object as Performance's and Usage's portfolio rows — four figures about
// the whole account — built with a different component. Two answers to one
// question, and the tab that argues hardest for being checkable was the one whose
// figures looked least like the ones it asks you to check them against.
//
// What the footnotes carried moves into the prose that owns it. The reach coverage
// and the 9-min assumption were the two worth keeping, and both are in the caveat
// under the goals block and the lead sentence above.
function renderLedger(ledger) {
  return renderPortfolioTiles([
    { title: "Reach, all posts via me", count: ledger.reach },
    { title: "Drafting time saved", metric: `~${Math.round(ledger.hoursSaved)} h` },
    { title: "Signals turned into work", metric: `${ledger.signalsActed} / ${ledger.signalsSurfaced}` },
    { title: "Kept without editing", count: ledger.keptRate, unit: "%" },
  ]);
}

// The two-bar comparison, before over after. Both bars are Archie's own posts in
// two consecutive windows — the only comparison this page can make without
// borrowing a baseline it cannot see.
function renderGoals(ledger, period) {
  if (ledger.improved.length === 0) {
    return `
      <section class="insights-value__section">
        <h2 class="insights-value__eyebrow">Goals, this window vs last</h2>
        <p class="insights-value__empty">
          No goal improved over the ${escapeText(periodLabel(period))}. Nothing to claim here —
          where each one stands reads on Objectives.
        </p>
      </section>`;
  }

  const rows = ledger.improved
    .map((g) => {
      const beforeShare = g.after ? Math.max(12, Math.round((g.before / g.after) * 72)) : 0;
      return `
      <div class="insights-value__goal">
        <div class="insights-value__goal-id">
          <span class="insights-value__goal-name">${escapeText(g.objective)}</span>
          <span class="insights-value__goal-playbook">${escapeText(g.playbook)}</span>
        </div>
        <div class="insights-value__goal-bars">
          <span class="insights-value__goal-bar insights-value__goal-bar--before" style="width: ${beforeShare}%"></span>
          <span class="insights-value__goal-bar insights-value__goal-bar--after" style="width: 72%"></span>
        </div>
        <div class="insights-value__goal-figures">
          <span class="insights-figure">
            ${g.before === null ? escapeText(g.value) : `${figure(g.before)} → ${figure(g.after)}`}
            ${renderTrend(g.variation)}
          </span>
          <span class="insights-value__goal-note">${escapeText(g.metric)}, my posts</span>
        </div>
      </div>`;
    })
    .join("");

  return `
    <section class="insights-value__section">
      <h2 class="insights-value__eyebrow">
        Goals, this window vs last
        <span class="insights-value__scope">
          ${escapeText(periodLabel(period))} vs the window before — both inside my own 60-day window
        </span>
      </h2>
      <div class="ap-card insights-value__goals">
        ${rows}
        <p class="insights-value__caveat">
          I compare only inside what I already see — my own posts, 60 days. No assembled baselines, no extra
          connections. Where a goal is still behind — ${ledger.behind} ${ledger.behind === 1 ? "is" : "are"} — it
          reads on the Objectives tab, not here. Longer history and native posts are an
          <button type="button" class="ap-link small" data-insights-bridge>Agorapulse view</button>.
        </p>
      </div>
    </section>`;
}

// The same posts the Performance panels call "what worked here", best three. One
// source, so a post cannot be 3.0× median on one tab and 3.4× on another.
function renderPosts(posts, period) {
  if (posts.length === 0) return "";
  return `
    <section class="insights-value__section">
      <h2 class="insights-value__eyebrow">
        The posts that made the case
        <span class="insights-value__scope">drafted with me · views and medians on the ${escapeText(periodLabel(period))}</span>
      </h2>
      <div class="insights-value__posts">
        ${posts
          .map(
            ({ context, worked }) => `
          <div class="ap-card insights-value__post">
            <span class="insights-value__post-origin">
              <strong>${escapeText(context.name)}</strong> · ${escapeText(worked.network)} · ${escapeText(worked.date)}
            </span>
            <p class="insights-value__post-excerpt">${escapeText(worked.excerpt)}</p>
            <span class="insights-figure insights-value__post-figure">
              ${escapeText(worked.views)} ·
              <span class="insights-post__multiple">${escapeText(worked.multiple)}</span>
              this Playbook's median
            </span>
          </div>`,
          )
          .join("")}
      </div>
    </section>`;
}

// Where Archie stops, said by Archie, in the dark block that closes the tab. It is
// the only bridge on this page and it is the honest half of the pitch: the reason
// these figures hold up in front of a boss is the same reason they cannot be the
// month-end document.
function renderBoundary() {
  return `
    <section class="insights-boundary">
      <h2 class="insights-boundary__title">Where I stop</h2>
      <p class="insights-boundary__body">
        Everything on this tab counts posts I published, over at most 60 days — that's why it holds up in front of a
        boss. The month-end document that includes native posts, every profile and network, and years of history is
        built in Report Studio; these numbers travel there wired.
      </p>
      <div class="insights-boundary__foot">
        <button type="button" class="ap-button primary orange" data-insights-bridge>
          <span>Build the report in Report Studio</span>
        </button>
        <span class="insights-boundary__note">One click — this window's ledger arrives as widgets.</span>
      </div>
    </section>`;
}

export function bindValueTab(root) {
  const onClick = (event) => {
    if (event.target.closest("[data-insights-start-chat]")) {
      navigate("/");
      return;
    }
    if (event.target.closest("[data-insights-bridge]")) {
      showToast("Report Studio isn't wired up in this prototype");
    }
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}
