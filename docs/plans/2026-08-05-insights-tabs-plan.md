# Insights Tabs Implementation Plan

> **For agentic workers:** use the `executing-plans` skill to work through this task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Stop at each task's final commit for review before starting
> the next. (`subagent-driven-development` is the other option the format offers, but it is not
> installed on this machine.)

**Goal:** Turn the single stacked `/analytics` page into `Insights`, a four-tab hub whose landing tab
is a "fun" usage surface, without changing what the existing page does.

**Architecture:** A thin shell (`src/screens/insights/shell.js`) owns the header, the global CTA and
the DS tab nav, and delegates to one module per tab. Today's 464-line `analytics.js` moves verbatim
into `performance.js`. The new `usage.js` reuses two components already extracted for this purpose
(`editorial-banner.js`, `report-widget.js`). One URL per tab, so the browser back button walks tabs.

**Tech Stack:** Vanilla ES modules, no build step, no framework. Hash router (`src/router.js`).
Agorapulse design system consumed as CSS classes (`ds/css-ui/index.css`, synced by
`scripts/sync-ds.mjs` — generated, gitignored, never edited). Prettier + husky/lint-staged on commit.

**Source documents:**

- **Spec (read first):** [`docs/specs/2026-08-05-insights-tabs-design.md`](../specs/2026-08-05-insights-tabs-design.md) — every decision and its reasoning.
- **Validated Usage mockup:** [`docs/specs/assets/2026-08-05-insights-usage-layout.html`](../specs/assets/2026-08-05-insights-usage-layout.html) — open it in a browser before Task 3.

**Scope:** steps 1–2 of the spec's build order. The **Voice and Team tabs are out of scope** — they
render a placeholder here and each gets its own design session.

## Global Constraints

Every task's requirements implicitly include this section.

- **The `?v=` cache-buster is transitive.** After changing any module run
  `python3 scripts/bump-cache.py <changed files…>`. Never bump by hand. Verify with
  `grep -rho "<module>.js?v=[0-9]*" src/ index.html | sort -u` → **exactly one version**. This bit the
  previous session twice, the second time silently: a new feature flag was invisible because a cached
  `feature-flags.js` kept importing a stale `ff-catalog.js`, and `isFlagOn` returns `false` for an
  unknown id.
- **Design-system gate.** No raw hex, no `!important`, never redeclare an `.ap-*` rule. Reuse the DS
  component before writing CSS.
- **Contrast floor.** ≥ 4.5:1 at 14px against the `#F9F9FA` page background. `--ref-color-grey-60`
  **fails** at 3.10:1 — use `--sys-text-color-light` (5.18:1) for secondary text.
- **No figure in a `title` attribute.** Data is visible or absent; a tooltip is unreachable by touch
  and keyboard.
- **Never mock what can be derived.** Playbook count and tone distribution come from `getContexts()`.
- **No randomness in `src/mocks.js`** — the file forbids it by design, and a shifting calendar makes
  screenshots unusable as a reference.
- **Naming rule.** Page-level names follow the page (`insights-*`); thing-level names do not
  (`analytics-card`, `analytics-row`, `analytics-legend`, `analytics-trend`, `analytics-bridge` stay —
  they name a health card, an objective row, a legend, a trend cell, the bridge).
- **Comment bars (`CLAUDE.md`, non-negotiable).** Nothing that restates its line; one line each unless
  a constraint needs spelling out; at most one per function; describe the code as it stands, never how
  it changed; no section banners.
- **English** for code, comments and commit messages.

## How verification works in this repo

**There is no test framework.** `package.json` carries only `prettier` and `husky`/`lint-staged` — no
vitest, no jest, no test files. Inventing a suite is out of scope for this plan.

So each task's cycle is: **write a browser assertion → run it and watch it fail → implement → run it
and watch it pass → commit.** The assertion is a JS snippet evaluated against the running page, in
DevTools' console or via a browser tool.

```bash
npm start   # npx serve -p 8000 — the canonical server for this repo
```

Then open `http://localhost:8000/#/insights/usage`. The server dies between sessions; restart it
rather than debugging a dead port. `.claude/launch.json` has an `archie` entry, but `preview_start`
resolves `launch.json` from the cwd, so launching it _by name_ fails from another worktree — pass the
URL instead.

Paste this helper once per session:

```js
const check = (label, actual, expected) =>
  console.log(
    JSON.stringify(actual) === JSON.stringify(expected)
      ? `PASS ${label}`
      : `FAIL ${label} → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`,
  );
```

## One pre-existing bug you will meet

`src/playbook-view.js:2117` calls an **undefined `portalModal()`**. It throws inside `paint()`, which
`mount()` runs _before_ it binds any listener — so **every click handler in the Playbook detail panel
is dead** (the rename pencil, "Add an objective", the section rail). It predates this work and does not
affect Insights. **Do not fix it as a side quest.** Expect 3–4 `portalModal is not defined` console
errors on `/playbook/:id` and treat them as the baseline.

## File structure

| File                                                     | Responsibility                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/screens/insights/shell.js`                          | **Create.** Header, global CTA, DS tab nav, tab routing. Knows tab _names_, never tab _content_.     |
| `src/screens/insights/performance.js`                    | **Create.** Today's `analytics.js` body, moved. Health cards, objective table, Report Studio bridge. |
| `src/screens/insights/usage.js`                          | **Create.** The two Usage blocks.                                                                    |
| `styles/screens/insights.css`                            | **Create** (git mv from `analytics.css`). Shell, tab nav, Usage.                                     |
| `src/screens/analytics.js`                               | **Delete** — content moves to `performance.js`.                                                      |
| `src/mocks.js`                                           | **Modify.** Add `archieUsage()` and `toneDistribution()`.                                            |
| `src/components/report-widget.js`                        | **Modify.** Optional narrative line.                                                                 |
| `src/app.js`                                             | **Modify.** Routes.                                                                                  |
| `src/components/sidebar.js`                              | **Modify.** Nav label + path.                                                                        |
| `src/ff-catalog.js`                                      | **Modify.** Flag prose only — **keep the flag id**.                                                  |
| `index.html`                                             | **Modify.** Stylesheet link.                                                                         |
| `docs/reference/ROUTES.md`, `docs/reference/FEATURES.md` | **Modify.** `CLAUDE.md` requires docs to track code.                                                 |

---

### Task 1: Insights shell, tab routing, Performance extraction

The restructure lands as one deliverable: splitting the rename out would mean touching every file
twice. **Nothing should visibly change except the nav label and a tab bar appearing.** That is exactly
what makes it risky — an invisible change hides its own regressions.

**Files:**

- Create: `src/screens/insights/shell.js`, `src/screens/insights/performance.js`
- Rename: `styles/screens/analytics.css` → `styles/screens/insights.css`
- Delete: `src/screens/analytics.js`
- Modify: `src/app.js`, `src/components/sidebar.js`, `src/ff-catalog.js`, `index.html`, `docs/reference/ROUTES.md`, `docs/reference/FEATURES.md`

**Interfaces:**

- Consumes: `flaggedCount()` from `components/action-drawer.js`; `getContexts()`, `subscribe()` from `contexts-store.js`; `renderEmptyState()` from `components/empty-state.js`; `route()` from `app.js`; `navigate()` from `router.js`.
- Produces:
  - `renderInsights(params, target) → cleanupFn` — the route handler, from `shell.js`.
  - `renderPerformanceTab() → string` — HTML for the Performance tab, from `performance.js`.
  - `bindPerformanceTab(root) → void` — the tab's own click delegation, from `performance.js`.
  - Tab ids: `"usage" | "performance" | "voice" | "team"`.

- [ ] **Step 1: Write the failing assertion**

Open `http://localhost:8000/#/insights/performance` and run:

```js
check("tab nav exists", !!document.querySelector(".ap-tabs-nav"), true);
check("four tabs", document.querySelectorAll(".ap-tabs-tab").length, 4);
check("H1 is Insights", document.querySelector("h1")?.textContent.trim(), "Insights");
check("health cards still render", document.querySelectorAll(".analytics-card").length, 4);
check("objective rows still render", document.querySelectorAll(".analytics-row").length, 8);
```

- [ ] **Step 2: Run it and verify it fails**

Expected: the route does not exist, so the page is empty. All five FAIL.

- [ ] **Step 3: Create `performance.js` by moving the existing page body**

Move **everything** from `src/screens/analytics.js` into `src/screens/insights/performance.js` except
`renderAnalytics()` and `renderHead()` — the header and CTA belong to the shell now. Fix the import
depth (`../../`), rename the two entry points, keep every other function byte-identical:

```js
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
    <p class="insights-tab__period">Last 30 days</p>
    ${renderEditorial()}
    <section class="insights-view__section">
      <div class="insights-view__section-head">
        <div class="insights-view__section-text">
          <h2 class="insights-view__section-title">Playbook health</h2>
          <p class="insights-view__section-note">
            Scored out of 100 — the average progress of a Playbook's objectives, lowered when a trend
            is flat or falling.
          </p>
        </div>
        ${renderTierLegend()}
      </div>
      <div class="insights-view__cards">${contexts.map(renderHealthCard).join("")}</div>
    </section>
    <section class="insights-view__section">
      <div class="insights-view__section-head">
        <h2 class="insights-view__section-title">Objectives</h2>
      </div>
      ${renderTableControls(contexts, visibleRows(rows).length, rows.length)}
      ${renderTable(visibleRows(rows))}
    </section>
    ${renderReportStudioBridge()}`;
}
```

The `insights-tab__period` line is the period moving **out of the header and into this tab**, per spec
decision 5. Usage states its own.

Rename `bind()` to an exported `bindPerformanceTab(root)`, unchanged otherwise. Keep `pageState`
module-local as it is today.

- [ ] **Step 4: Create `shell.js`**

```js
import { html, raw } from "../../utils.js?v=21";
import { renderTopbar } from "../../components/topbar.js?v=297";
import { getContexts, subscribe as subscribeContexts } from "../../contexts-store.js?v=47";
import { navigate } from "../../router.js?v=30";
import { renderEmptyState } from "../../components/empty-state.js?v=1";
import { flaggedCount } from "../../components/action-drawer.js?v=8";
import { renderPerformanceTab, bindPerformanceTab } from "./performance.js?v=1";
import { renderUsageTab } from "./usage.js?v=1";

// Insights — the portfolio layer above a single Playbook's detail, as four tabs.
//
// This module knows the tabs' names, never their content: each entry owns its own
// rendering and its own period. The header holds the one thing true of every tab —
// that N objectives need attention — so a user who never leaves Usage still sees it.

const TABS = [
  { id: "usage", label: "Usage", icon: "ap-icon-sparkles", render: renderUsageTab },
  {
    id: "performance",
    label: "Performance",
    icon: "ap-icon-bar-graph",
    render: renderPerformanceTab,
    bind: bindPerformanceTab,
  },
  { id: "voice", label: "Voice", icon: "ap-icon-quote", render: renderVoicePlaceholder },
  { id: "team", label: "Team", icon: "ap-icon-user", render: renderTeamPlaceholder },
];

const DEFAULT_TAB = "usage";

let unsubscribe = null;

export function renderInsights(params, target) {
  renderTopbar();
  const active = TABS.some((t) => t.id === params.tab) ? params.tab : DEFAULT_TAB;
  if (active !== params.tab) {
    navigate(`/insights/${DEFAULT_TAB}`);
    return () => {};
  }

  if (unsubscribe) unsubscribe();
  const paint = () => {
    target.innerHTML = html`<section class="screen insights-view">${raw(renderPage(active))}</section>`;
    bind(target, active);
  };
  paint();
  unsubscribe = subscribeContexts(paint);

  return () => {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  };
}

function renderPage(active) {
  const tab = TABS.find((t) => t.id === active);
  return `
    <div class="insights-view__page">
      ${renderHead()}
      ${renderTabNav(active)}
      <div
        class="insights-view__panel"
        role="tabpanel"
        id="insights-panel-${active}"
        aria-labelledby="insights-tab-${active}"
      >
        ${tab.render()}
      </div>
    </div>`;
}

// The one action on the page, and the only place the count appears. Orange primary is
// what the DS reserves for AI actions, and this opens Archie's recommendations.
function renderHead() {
  const flagged = flaggedCount();
  const cta =
    flagged > 0
      ? `<button type="button" class="ap-button primary orange insights-view__cta" data-open-action-drawer>
          <i class="ap-icon-sparkles" aria-hidden="true"></i>
          <span>Review ${flagged} ${flagged === 1 ? "objective" : "objectives"} that need${flagged === 1 ? "s" : ""} attention</span>
        </button>`
      : `<p class="insights-view__all-clear">
          <i class="ap-icon-check" aria-hidden="true"></i>
          Every objective is on track
        </p>`;

  return `
    <header class="insights-view__head">
      <div class="insights-view__head-text">
        <h1 class="insights-view__title">Insights</h1>
        <p class="insights-view__sub">${getContexts().length} Playbooks</p>
      </div>
      ${cta}
    </header>`;
}

function renderTabNav(active) {
  const tabs = TABS.map(
    (t) => `
    <button
      type="button"
      class="ap-tabs-tab ${t.id === active ? "active" : ""}"
      role="tab"
      id="insights-tab-${t.id}"
      aria-selected="${t.id === active}"
      aria-controls="insights-panel-${t.id}"
      data-insights-tab="${t.id}"
    >
      <i class="${t.icon}" aria-hidden="true"></i>
      <span>${t.label}</span>
    </button>`,
  ).join("");

  return `<div class="ap-tabs insights-view__tabs"><div class="ap-tabs-nav" role="tablist">${tabs}</div></div>`;
}

function renderVoicePlaceholder() {
  return renderEmptyState({
    icon: "ap-icon-quote",
    title: "Voice is coming",
    body: "A portfolio view of your brand voice across Playbooks — what recurs, what diverges, what Archie avoids.",
    wrapperClass: "insights-view__empty",
  });
}

function renderTeamPlaceholder() {
  return renderEmptyState({
    icon: "ap-icon-user",
    title: "Team is coming",
    body: "Who uses Archie across the organisation.",
    wrapperClass: "insights-view__empty",
  });
}

// Tabs navigate rather than mutating local state, so the back button walks them.
function bind(root, active) {
  root.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-insights-tab]");
    if (tab) navigate(`/insights/${tab.dataset.insightsTab}`);
  });
  TABS.find((t) => t.id === active)?.bind?.(root);
}
```

Confirm the icons exist before committing — the DS has no `ap-icon-users`:

```bash
grep -o '\.ap-icon-\(sparkles\|bar-graph\|quote\|user\|check\)\b' ds/ap-icons.css | sort -u
```

If one is missing, list the available set with
`grep -o '\.ap-icon-[a-z-]*' ds/ap-icons.css | sort -u` and pick the closest.

- [ ] **Step 5: Move the stylesheet and rename page-level classes**

```bash
git mv styles/screens/analytics.css styles/screens/insights.css
sed -i '' 's/analytics-view__/insights-view__/g' styles/screens/insights.css src/screens/insights/*.js
```

That covers `analytics-view__mini-row` → `insights-view__mini-row` too. Leave `analytics-card`,
`analytics-row`, `analytics-legend`, `analytics-trend`, `analytics-bridge` alone.

Append the shell's own rules:

```css
.insights-view__tabs {
  margin-bottom: var(--ref-spacing-md);
}

.insights-view__panel {
  display: flex;
  flex-direction: column;
  gap: var(--ref-spacing-xl);
}

/* Each tab states its own range — Usage is deliberately long-history while
   Performance stays bounded, so one page-level period would lie about half the hub. */
.insights-tab__period {
  margin: 0;
  font-size: var(--ref-font-size-sm);
  color: var(--sys-text-color-light);
}
```

- [ ] **Step 6: Wire the routes and the nav**

In `src/app.js`, replace the `/analytics` route:

```js
route("/insights", () => {
  navigate("/insights/usage");
  return () => {};
});
route("/insights/:tab", renderInsights);
// Links to the old path were shared before the rename.
route("/analytics", () => {
  navigate("/insights/usage");
  return () => {};
});
```

In `src/components/sidebar.js`:

```js
{
  path: "/insights/usage",
  icon: "ap-icon-bar-graph",
  label: "Insights",
  flag: "rootAnalytics",
  match: (p) => p.startsWith("/insights"),
},
```

In `src/ff-catalog.js`, update the `rootAnalytics` prose to say "Insights hub" and name the four tabs.
**Keep the flag id**: renaming it silently turns the hub off for anyone whose localStorage already
holds the old key.

In `index.html`, point the stylesheet link at `screens/insights.css`.

- [ ] **Step 7: Bump the cache-buster and format**

```bash
python3 scripts/bump-cache.py src/app.js src/components/sidebar.js src/ff-catalog.js
npx prettier --write src/screens/insights styles/screens/insights.css index.html src/app.js src/components/sidebar.js src/ff-catalog.js
grep -rho "sidebar.js?v=[0-9]*" src/ index.html | sort -u   # expect exactly one line
```

New files need a starting `?v=1` in their importers — `bump-cache.py` only bumps references that
already exist.

- [ ] **Step 8: Run the assertion and verify it passes**

All five checks PASS. Then walk the regression list, which is the point of this task:

- Every route renders: `#/`, `#/contexts`, `#/insights/usage`, `#/insights/performance`,
  `#/insights/voice`, `#/insights/team`, `#/playbook/ctx-acme`.
- `#/analytics` lands on `#/insights/usage`.
- Clicking tabs changes the URL; browser back walks them.
- Performance shows 4 health cards, 8 rows, both filter dropdowns, the legend, `/100` on the rings,
  and the bridge in both states (toggle `agorapulseEntitlement` in the admin menu).
- The CTA opens the drawer from **every** tab and returns focus to the CTA on Esc.
- The second drawer door inside `#/playbook/ctx-customer` still opens, scoped to that Playbook.
- No console errors beyond the `portalModal` baseline.

- [ ] **Step 9: Update the docs**

`docs/reference/ROUTES.md` — replace the `/analytics` row with `/insights` (redirect) and
`/insights/:tab`, plus the `/analytics` legacy redirect. Match the table's existing French prose.
`docs/reference/FEATURES.md` — the hub is described there as one page; make it four tabs and mark
Voice/Team as placeholders.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(insights): the hub becomes four tabs, and the page keeps working

Today's 464-line analytics.js splits into a shell that owns the header, the global
CTA and the tab nav, plus one module per tab. Performance is a move, not a rewrite.

The nav entry and the H1 become Insights because a container and its contents cannot
share a name — that collision is what made a missing Performance entry look like a
bug. Page-level classes follow the page; analytics-card and analytics-row stay, since
they name a health card and an objective row rather than the page.

The period line moves out of the header into Performance: Usage is deliberately
long-history, so one page-level range would lie about half the hub.

/analytics redirects rather than 404s — links were shared before the rename."
```

---

### Task 2: `archieUsage()` — the Usage tab's data

Data before UI, so the next two tasks build against a fixed shape.

**Files:**

- Modify: `src/mocks.js`

**Interfaces:**

- Produces:
  - `archieUsage() → { lead, produced, work }` with
    `lead: { before, highlight, after }`,
    `produced: { keptRate: number, widgets: Array<{ id, title, value, variation, size, narrative }> }`,
    `work: { networks: Array<{ label, share }>, calendar: number[], calendarLabel: string, calendarNote: string, streak: number, longestStreak: number }`.
  - `toneDistribution() → Array<{ label: string, count: number }>` — **derived from the real
    Playbooks**, sorted by count desc then label asc.

- [ ] **Step 1: Write the failing assertion**

```js
const m = await import("/src/mocks.js");
check("archieUsage exists", typeof m.archieUsage, "function");
check("calendar length", m.archieUsage().work?.calendar?.length, 90);
check("tones derived", m.toneDistribution().reduce((n, t) => n + t.count, 0) > 0, true);
```

- [ ] **Step 2: Run it and verify it fails**

Expected: `FAIL archieUsage exists → got "undefined"`.

- [ ] **Step 3: Add the data next to `archieImpact()`**

```js
// ---- Archie's usage (the Insights › Usage tab) -----------------------------
//
// The counterpoint to the objective tables: what Archie produced, and how you work
// with it. Read once, warmly — a hook, not a scoreboard, hence a narrative line per
// figure.
//
// `keptRate` and `calendar` are the two figures the platform records nowhere today:
// nothing tracks whether a draft was edited after generation, and no timestamp of
// creation activity is stored. The spec's data table carries that requirement.
//
// Playbook count and tone distribution are deliberately absent here — they are
// derived from the real Playbooks so this tab cannot contradict /contexts.
const ARCHIE_USAGE = {
  lead: {
    before: "Archie has written",
    highlight: "148,200 words",
    after: "for you this month — enough to publish every week for two years.",
  },
  produced: {
    keptRate: 71,
    widgets: [
      {
        id: "usage-drafts",
        title: "Drafts generated",
        value: "2,431",
        variation: 18,
        size: "mini",
        narrative: "81 a week on average.",
      },
      {
        id: "usage-posts",
        title: "Posts published",
        value: "318",
        variation: 12,
        size: "mini",
        narrative: "13% of drafts make it online.",
      },
      {
        id: "usage-sources",
        title: "Sources digested",
        value: "67",
        variation: 9,
        size: "mini",
        narrative: "12 of them reused more than once.",
      },
    ],
  },
  work: {
    networks: [
      { label: "LinkedIn", share: 62 },
      { label: "X", share: 24 },
      { label: "Instagram", share: 14 },
    ],
    // 90 days of intensity, 0–3, hand-authored: this file forbids randomness, and a
    // calendar that shifts per reload makes a screenshot useless as a reference.
    calendar: [
      0, 1, 2, 0, 3, 2, 0, 1, 3, 3, 0, 2, 1, 3, 2, 0, 3, 3, 1, 0, 2, 0, 3, 3, 1, 0, 2, 3, 0, 1, 2, 3, 0, 3, 2, 1, 3, 3,
      0, 2, 0, 2, 1, 3, 0, 3, 2, 0, 3, 1, 2, 3, 3, 0, 1, 2, 3, 0, 3, 3, 3, 0, 1, 2, 3, 3, 0, 2, 1, 0, 3, 2, 3, 1, 0, 3,
      2, 3, 3, 0, 2, 1, 3, 0, 3, 2, 1, 3, 0, 2,
    ],
    calendarLabel: "Last 90 days",
    calendarNote: "Your Tuesday is your most productive day.",
    streak: 6,
    longestStreak: 21,
  },
};

export function archieUsage() {
  return ARCHIE_USAGE;
}

// Derived, never mocked: a hardcoded tone would let the Usage tab contradict the
// Playbook list the moment someone edits a Playbook.
export function toneDistribution() {
  const counts = new Map();
  for (const context of contexts) {
    for (const tone of context.tones || []) counts.set(tone, (counts.get(tone) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
```

- [ ] **Step 4: Run the assertion and verify it passes**

All three PASS. Then confirm the derivation is live: add a tone to a Playbook in `mocks.js`, reload,
and watch `toneDistribution()` follow.

- [ ] **Step 5: Bump, format and commit**

```bash
python3 scripts/bump-cache.py src/mocks.js
npx prettier --write src/mocks.js
git add -A
git commit -m "feat(insights): usage figures, and the two that are derived rather than mocked

Playbook count and tone distribution come from the real Playbooks: a hardcoded tone
would let the tab contradict /contexts the moment someone edits one, which is the
defect class the 2026-08-05 audit charged us for.

The calendar is 90 hand-authored values. mocks.js forbids randomness, and a calendar
that shifts per reload makes a screenshot useless as a reference.

keptRate and calendar are the two figures the platform records nowhere — no
edit-tracking on a draft, no timestamp of creation activity. Carried as a requirement
in the spec's data table rather than buried here."
```

---

### Task 3: Usage tab — the "What Archie produced" block

**Files:**

- Create: `src/screens/insights/usage.js`
- Modify: `src/components/report-widget.js`, `styles/screens/welcome.css`, `styles/screens/insights.css`

**Interfaces:**

- Consumes: `archieUsage()` from `mocks.js`; `renderEditorialBanner()` from `components/editorial-banner.js`; `renderMiniWidget()` from `components/report-widget.js`.
- Produces: `renderUsageTab() → string`, already imported by `shell.js` in Task 1.

- [ ] **Step 1: Write the failing assertion**

On `#/insights/usage`:

```js
check("lead renders", !!document.querySelector(".editorial-lead"), true);
check("three volume widgets", document.querySelectorAll(".insights-usage__produced .recap__widget--mini").length, 4);
check("narrative lines", document.querySelectorAll(".recap__overview-narrative").length, 4);
check("gauge value is text too", document.querySelector(".insights-gauge__value")?.textContent.trim(), "71%");
```

The gauge card is itself a `.recap__widget--mini`, hence 4 rather than 3.

- [ ] **Step 2: Run it and verify it fails**

Expected: the Usage tab is still whatever placeholder Task 1 left. All FAIL.

- [ ] **Step 3: Give `renderMiniWidget` an optional narrative line**

Extend rather than fork, so Performance's widgets stay untouched. In
`src/components/report-widget.js`, after the `.recap__overview-content` div:

```js
        ${w.narrative ? `<span class="recap__overview-narrative">${esc(w.narrative)}</span>` : ""}
```

In `styles/screens/welcome.css`, beside the other `.recap__overview-*` rules:

```css
.recap__overview-narrative {
  font-size: var(--ref-font-size-sm);
  font-style: italic;
  color: var(--sys-text-color-light);
}
```

- [ ] **Step 4: Create `usage.js`**

```js
import { escapeText } from "../../utils.js?v=21";
import { archieUsage } from "../../mocks.js?v=74";
import { renderEditorialBanner } from "../../components/editorial-banner.js?v=2";
import { renderMiniWidget } from "../../components/report-widget.js?v=3";

// Insights › Usage — what Archie produced, and how you work with it.
//
// The counterpoint to Performance: nothing here compares a number to a goal. Ranges
// differ per card on purpose and each one says so — a bare number is what is
// forbidden, not a second range.

export function renderUsageTab() {
  const { lead, produced } = archieUsage();

  return `
    <p class="insights-tab__period">Last 30 days</p>
    ${renderEditorialBanner({ lead })}
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">What Archie produced</h2>
      <div class="insights-usage__produced">
        ${renderGauge(produced.keptRate)}
        ${produced.widgets.map((w) => renderMiniWidget(w)).join("")}
      </div>
    </section>`;
}

// A gauge expresses a part of a whole, so it is reserved for the one rate on this tab
// — putting one on a volume like "2,431 drafts" would be a visual lie. Same annulus
// as the Playbook health ring, so the two read as one system.
function renderGauge(rate) {
  return `
    <div class="recap__widget recap__widget--mini insights-gauge">
      <span class="recap__overview-title">Kept without editing</span>
      <div
        class="insights-gauge__dial"
        style="--gauge-progress: ${rate}"
        role="img"
        aria-label="${rate}% of drafts kept without editing"
      >
        <span class="insights-gauge__value">${escapeText(String(rate))}%</span>
      </div>
      <span class="recap__overview-narrative">Of 2,431 drafts generated.</span>
    </div>`;
}
```

- [ ] **Step 5: Style the block and the gauge**

In `styles/screens/insights.css`:

```css
.insights-usage__produced {
  display: grid;
  grid-template-columns: 0.85fr repeat(3, minmax(0, 1fr));
  gap: var(--ref-spacing-sm);
}

@media (max-width: 900px) {
  .insights-usage__produced {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Same annulus technique as .analytics-card__ring: a conic sweep with an inner disc
   punching the hole, so it reads as one rate rather than a pie of parts. */
.insights-gauge__dial {
  --gauge-progress: 0;
  position: relative;
  align-self: center;
  width: 72px;
  height: 72px;
  border-radius: var(--app-radius-circle);
  background: conic-gradient(
    var(--ref-color-green-150) calc(var(--gauge-progress) * 1%),
    var(--ref-color-grey-10) calc(var(--gauge-progress) * 1%)
  );
  display: grid;
  place-items: center;
}

.insights-gauge__dial::before {
  content: "";
  position: absolute;
  inset: 7px;
  border-radius: var(--app-radius-circle);
  background: var(--ref-color-white);
}

.insights-gauge__value {
  position: relative;
  font-size: var(--sys-text-style-h3-size);
  font-weight: var(--sys-text-style-body-bold-weight);
  color: var(--ref-color-grey-100);
}
```

- [ ] **Step 6: Bump, format, run the assertion**

```bash
python3 scripts/bump-cache.py src/components/report-widget.js
npx prettier --write src/screens/insights styles/screens/insights.css styles/screens/welcome.css src/components/report-widget.js
```

All four checks PASS. Then confirm Performance is unaffected: `#/insights/performance` still shows its
4 editorial widgets with **no** narrative lines.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(insights): the Usage tab opens with what Archie produced

A sentence, then the figures it alludes to. The gauge is reserved for the tab's one
rate — drafts kept without editing — because a gauge expresses a part of a whole and
putting one on a volume would be a visual lie. It reuses the health ring's annulus so
the two read as one system.

renderMiniWidget gains an optional narrative line rather than being forked, so
Performance's widgets are untouched."
```

---

### Task 4: Usage tab — the "How you work" block

**Files:**

- Modify: `src/screens/insights/usage.js`, `styles/screens/insights.css`

**Interfaces:**

- Consumes: `archieUsage().work` and `toneDistribution()` from `mocks.js`; `getContexts()` from `contexts-store.js`.
- Produces: nothing new — extends `renderUsageTab()`.

- [ ] **Step 1: Write the failing assertion**

```js
check("two bar lists", document.querySelectorAll(".insights-bars").length, 2);
check("calendar cells", document.querySelectorAll(".insights-calendar__cell").length, 90);
check(
  "calendar states its own range",
  document.querySelector(".insights-calendar__range")?.textContent.trim(),
  "Last 90 days",
);
```

- [ ] **Step 2: Run it and verify it fails**

Expected: all three FAIL — the block does not exist.

- [ ] **Step 3: Extend `usage.js`**

Add to the imports:

```js
import { archieUsage, toneDistribution } from "../../mocks.js?v=74";
import { getContexts } from "../../contexts-store.js?v=47";
```

Destructure `work` in `renderUsageTab()` and append this section to its template:

```js
<section class="insights-view__section">
  <h2 class="insights-view__section-title">How you work</h2>
  <div class="insights-usage__work">
    <div class="recap__widget">
      $
      {renderBars(
        "Where you publish",
        work.networks.map((n) => ({ value: n.share, caption: `${n.label} · ${n.share}%` })),
      )}
      ${renderBars("The tone that recurs", toneBars())}
    </div>
    ${renderCalendar(work)}
  </div>
</section>
```

and these helpers:

```js
// A tone shown as a single value says nothing; three tones spread over four Playbooks
// says something about the brand.
function toneBars() {
  const total = getContexts().length || 1;
  return toneDistribution().map((t) => ({
    value: (t.count / total) * 100,
    caption: `${t.label} · ${t.count} ${t.count === 1 ? "Playbook" : "Playbooks"}`,
  }));
}

function renderBars(title, rows) {
  const bars = rows
    .map(
      (r) => `
      <div class="insights-bars__row">
        <div class="insights-bars__bar" style="width: ${Math.max(4, Math.round(r.value))}%"></div>
        <span class="insights-bars__caption">${escapeText(r.caption)}</span>
      </div>`,
    )
    .join("");
  return `
    <div class="insights-bars">
      <h3 class="insights-bars__title">${escapeText(title)}</h3>
      ${bars}
    </div>`;
}

// Its own range label, so it does not contradict the tab's 30-day header.
function renderCalendar({ calendar, calendarLabel, calendarNote, streak, longestStreak }) {
  const cells = calendar
    .map((level) => `<span class="insights-calendar__cell insights-calendar__cell--${level}"></span>`)
    .join("");
  return `
    <div class="recap__widget">
      <div class="insights-calendar__head">
        <h3 class="insights-bars__title">${streak}-day streak</h3>
        <span class="ap-status grey no-dot">Longest: ${longestStreak} days</span>
      </div>
      <span class="insights-calendar__range">${escapeText(calendarLabel)}</span>
      <div class="insights-calendar__grid" role="img" aria-label="Creation activity over ${calendar.length} days">
        ${cells}
      </div>
      <span class="recap__overview-narrative">${escapeText(calendarNote)}</span>
    </div>`;
}
```

- [ ] **Step 4: Style it**

```css
.insights-usage__work {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ref-spacing-sm);
}

@media (max-width: 900px) {
  .insights-usage__work {
    grid-template-columns: minmax(0, 1fr);
  }
}

.insights-bars__title {
  margin: 0 0 var(--ref-spacing-xs);
  font-size: var(--ref-font-size-sm);
  font-weight: var(--sys-text-style-body-bold-weight);
  color: var(--ref-color-grey-100);
}

.insights-bars + .insights-bars {
  margin-top: var(--ref-spacing-md);
}

.insights-bars__row {
  display: flex;
  align-items: center;
  gap: var(--ref-spacing-xxs);
  margin-bottom: var(--ref-spacing-xxs);
}

.insights-bars__bar {
  height: 16px;
  border-radius: var(--ref-border-radius-sm);
  background: var(--ref-color-green-150);
}

.insights-bars__caption {
  font-size: var(--ref-font-size-sm);
  color: var(--sys-text-color-light);
  white-space: nowrap;
}

.insights-calendar__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ref-spacing-xs);
}

.insights-calendar__range {
  display: block;
  margin-bottom: var(--ref-spacing-xs);
  font-size: var(--ref-font-size-sm);
  color: var(--sys-text-color-light);
}

.insights-calendar__grid {
  display: grid;
  grid-template-columns: repeat(18, 1fr);
  gap: 3px;
  margin-bottom: var(--ref-spacing-xs);
}

.insights-calendar__cell {
  aspect-ratio: 1;
  border-radius: 2px;
  background: var(--ref-color-grey-10);
}

.insights-calendar__cell--1 {
  background: var(--ref-color-green-40);
}
.insights-calendar__cell--2 {
  background: var(--ref-color-green-100);
}
.insights-calendar__cell--3 {
  background: var(--ref-color-green-150);
}
```

Confirm the green steps exist: `grep -rho -- "--ref-color-green-[0-9]*" ds/ | sort -u`. If `green-40`
is absent, use `green-20`.

- [ ] **Step 5: Bump, format, run the assertion**

All three PASS, and the tone bars match `/contexts`: the counts sum to the number of `tones` entries
across the four Playbooks.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(insights): the Usage tab's second block, how you work

Two bar lists and the streak calendar. The tone list is derived from the real
Playbooks, so it cannot drift from /contexts — and three tones spread over four
Playbooks says something a lone 'Direct' never could.

The calendar carries its own range label. The tab's header says 30 days and the
calendar covers 90; both are true, and what the audit forbids is a number without its
range, not a second range."
```

---

### Task 5: Accessibility and consistency gate

The audit behind this design scored the old page 5/10 on its second pass. This task is the measured
gate that stops the new surface from starting there.

**Files:**

- Modify: whatever the measurements find.

- [ ] **Step 1: Run the measured checks on `#/insights/usage`**

```js
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const bgOf = (el) => {
  let e = el;
  while (e) {
    const c = getComputedStyle(e).backgroundColor;
    if (c && !/rgba?\(0, 0, 0, 0\)|transparent/.test(c)) return parse(c);
    e = e.parentElement;
  }
  return [255, 255, 255];
};
const ratio = (el) => {
  const cs = getComputedStyle(el);
  const L1 = lum(parse(cs.color)),
    L2 = lum(bgOf(el));
  const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  const px = parseFloat(cs.fontSize);
  const large = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700);
  return { ratio: +r.toFixed(2), px, pass: r >= (large ? 3 : 4.5) };
};

console.table(
  [...document.querySelectorAll("#app *")]
    .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .map((e) => ({ text: e.innerText.trim().slice(0, 30), ...ratio(e) }))
    .filter((r) => !r.pass),
);

check("no figure hidden in a title", document.querySelectorAll("#app [title]").length, 0);
```

- [ ] **Step 2: Fix every row the contrast table lists**

An empty table is the pass condition. Any row is a real failure: swap `--ref-color-grey-60` for
`--sys-text-color-light`. Do not invent a colour.

- [ ] **Step 3: Check the keyboard path on both new tabs**

Tab through `#/insights/usage` and `#/insights/performance`: every control reachable, focus visible,
the tab nav operable with Enter. Nothing reachable by mouse only.

- [ ] **Step 4: Check the DS gate**

```bash
grep -n '#[0-9a-fA-F]\{3,8\}\b\|!important' styles/screens/insights.css   # comments only
```

- [ ] **Step 5: Re-read your own diff against the comment bars**

`git diff HEAD~4` — delete any comment that restates its line, runs past one line without spelling out
a constraint, appears twice in one function, or narrates a change. `CLAUDE.md` calls this the whole
enforcement.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(insights): close the accessibility gate on the new tabs"
```

---

## Self-review of this plan

Checked against the spec, 2026-08-05.

- **Spec coverage.** Decisions 1–9 all land: 1 and 9 in Task 1 Steps 5–6, 2 in the `TABS` table, 3 via
  `DEFAULT_TAB`, 4 in `renderHead()`, 5 in `.insights-tab__period` (Tasks 1, 3), 6 in the file
  structure, 7 in Task 1 Step 6, 8 by omission — no Share control appears anywhere. The spec's data
  table maps to Task 2; the Usage layout to Tasks 3–4.
- **Out of scope holds.** Voice and Team are placeholders. No sortable columns, no tier rename, no
  `portalModal` fix.
- **Known deviation from the mockup.** It is written in French; the app is English. Task 2 Step 3
  carries the English copy.
- **Interface consistency.** `renderPerformanceTab`, `bindPerformanceTab`, `renderUsageTab`,
  `archieUsage`, `toneDistribution`, and `renderMiniWidget(w)` with `w.narrative` are used under those
  exact names everywhere they appear.
- **No test framework.** The TDD cycle is adapted to browser assertions rather than inventing a suite;
  stated up front in "How verification works in this repo".
