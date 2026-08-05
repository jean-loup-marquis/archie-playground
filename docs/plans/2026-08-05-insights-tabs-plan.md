# Insights tabs — implementation plan

**Status:** ready to implement. Written 2026-08-05 to hand off to a fresh conversation without losing
the session that produced it.

**Design (read this first):**
[`docs/specs/2026-08-05-insights-tabs-design.md`](../specs/2026-08-05-insights-tabs-design.md) — every
decision and its reasoning. This plan is the how; the spec is the what and the why.

**Validated Usage mockup:**
[`docs/specs/assets/2026-08-05-insights-usage-layout.html`](../specs/assets/2026-08-05-insights-usage-layout.html)
— open it in a browser before building tab 2.

**Scope:** steps 1 and 2 of the spec's build order (shell + Performance extraction, then the Usage
tab). Voice and Team are out — each needs its own design session.

## Goal

Turn the single stacked `/analytics` page into `Insights`, a four-tab hub whose landing tab is a
"fun" usage surface, without changing what the existing page does.

## Technical grounding (verified in this repo, 2026-08-05)

- **Branch** `proto/analytics-root-hub`, head `9dc613ee`. Never merged, disposable by design.
- `src/screens/analytics.js` — **464 lines**, the whole hub. `styles/screens/analytics.css` — 540 lines.
- `src/app.js` — routes are `route("/path", handler)` calls; `src/router.js` is the hash matcher.
- `src/components/sidebar.js` — nav is a declarative `NAV` array (`{ path, icon, label, flag, match }`).
  The Analytics entry deliberately carries **no `count`** (see spec decision on badges).
- **DS tabs exist**: `.ap-tabs` / `.ap-tabs-nav` / `.ap-tabs-tab` (+ `.active`), already used in
  `src/components/content-workspace.js:128` with icon + label + `.ap-counter`. Copy that markup.
- `src/components/action-drawer.js` — owns its own document-level delegation on
  `[data-open-action-drawer]` (optional `data-context-id`), and returns focus to the trigger on close.
  **Nothing to wire**: render the attribute and it works.
- `src/components/report-widget.js` — `renderMiniWidget(w, { style })`, shared by the hub and
  `playbook-view.js`. Reuse for Usage's volume cards.
- `src/components/editorial-banner.js` — `renderEditorialBanner({ lead })`, plain 24px sentence, no
  card. Reuse for Usage's opening sentence.
- `src/mocks.js` — `archieImpact(context?)` is the shape to mirror for `archieUsage()`.
- **`scripts/bump-cache.py` exists and is transitive** (fixpoint up to `index.html`). Use it; see
  Working rules.

### One pre-existing bug you will meet

`src/playbook-view.js:2117` calls an **undefined `portalModal()`**. It throws inside `paint()`, which
`mount()` runs _before_ it binds any listener — so **every click handler in the Playbook detail panel
is dead** (the rename pencil, "Add an objective", the section rail). It is not caused by this work and
it does not affect Insights. Do not "fix" it as a side quest; if it blocks a check, note it. A fix
exists on a separate branch and was never merged here.

## Step 1 — shell + Performance extraction

Ships alone. **Nothing should visibly change except the rename and a tab bar appearing with one
populated tab.** This is the risky step precisely because it should be invisible.

### Files

```
src/screens/insights/
  shell.js         header + tab nav + delegation to the active tab
  performance.js   today's analytics.js body, moved verbatim
styles/screens/insights.css   shell + tab-nav styles only
```

`src/screens/analytics.js` and `styles/screens/analytics.css` are **deleted**, their content moved.

### `shell.js`

- Declarative tab table: `const TABS = [{ id, label, icon, render }]` — `usage`, `performance`,
  `voice`, `team`. Adding or removing a tab is one line. Voice and Team render a placeholder in this
  step (an `renderEmptyState()` saying the tab is coming), so the nav is honest rather than showing
  tabs that do nothing on click.
- Header: `<h1>Insights</h1>` and the global CTA
  (`ap-button primary orange` + `data-open-action-drawer`, label `Review N objectives that need
attention`, from `flaggedCount()`). **No period line here** — each tab states its own.
- Tab nav using the DS classes, with `aria-selected` and `role="tab"` / `role="tabpanel"`.
- Delegates to `TABS.find(t => t.id === active).render()`.

### Routing

| Route             | Behaviour                                                          |
| ----------------- | ------------------------------------------------------------------ |
| `#/insights`      | redirect to `#/insights/usage`                                     |
| `#/insights/:tab` | the shell, with `:tab` active; unknown tab → redirect to `usage`   |
| `#/analytics`     | redirect to `#/insights/usage` — links already shared keep working |

Tab clicks `navigate()` to the tab's URL rather than mutating local state, so the back button walks
the tabs. That is the whole reason for one URL per tab.

### Renames

Follow the spec's rule — **page names follow the page, thing names do not**:

- rename: `analytics-view__*` → `insights-view__*`, the route, the sidebar label, the H1.
- keep: `analytics-card`, `analytics-row`, `analytics-legend`, `analytics-trend`, `analytics-bridge`.
  They name a health card, an objective row, a legend, a trend cell, the bridge — not the page.
- `src/ff-catalog.js`: the `rootAnalytics` flag description says "Analytics hub"; update the prose,
  **keep the flag id** (renaming it would silently turn the hub off for anyone whose localStorage
  already stores the old key).

### Verification

- Every route still renders: `/`, `/contexts`, `/insights/*`, `/playbook/:id`.
- `#/analytics` lands on Usage. Browser back walks tabs.
- The Performance tab is byte-for-byte the old page: 4 health cards, 8 rows, filters, legend, `/100`
  rings, the bridge in both entitlement states (`agorapulseEntitlement` flag).
- The CTA opens the drawer from any tab and returns focus on close.
- The second drawer door in `playbook-view.js` still works.
- No new console errors beyond the `portalModal` ones.

## Step 2 — Usage tab

Build from the mockup, not from prose. Open
[`assets/2026-08-05-insights-usage-layout.html`](../specs/assets/2026-08-05-insights-usage-layout.html)
side by side.

### Data — `archieUsage()` in `src/mocks.js`

Mirror `archieImpact()`: figures and their narrative strings in one place. **Two fields must NOT be
in the mock** — compute them at render:

| Derived, never mocked | From                                         |
| --------------------- | -------------------------------------------- |
| Playbooks active      | `getContexts().length`                       |
| Tone distribution     | `contexts[].tones`, counted across Playbooks |

Mocking either would let the tab contradict the Playbook list, which is the defect class the
2026-08-05 audit charged us for.

Everything else is mock: words written, drafts generated, drafts kept without editing (%), posts
published, sources digested, network mix, the calendar. The spec's data table records what the
platform must expose and separates aggregation problems from missing instrumentation — that table is
a PRD deliverable, keep it accurate if the figures change.

The calendar is a **static deterministic array** of ~90 intensity values (0–3). No `Math.random` —
`mocks.js` forbids randomness by design, and a shifting calendar makes screenshots unreproducible.

### Layout

1. **Editorial lead**, full width — reuse `renderEditorialBanner()`. States its own range ("this
   month").
2. **Block "What Archie produced"** under a subheading: the gauge card, then three
   `renderMiniWidget()` cards each with one narrative line.
   - The **gauge is reserved for the one rate on the page** (drafts kept without editing). A gauge
     expresses a part of a whole; putting one on a volume would be a visual lie. Build it the way
     `.analytics-card__ring` does — a conic-gradient annulus with an inner disc punching the hole —
     or a half-arc in SVG as the mockup shows. Either way, no new colour: DS tokens only.
   - `renderMiniWidget()` has no narrative-line slot today. Add one as an optional field rather than
     forking the component, so Performance's widgets are unaffected.
3. **Block "How you work"**, two cards side by side: the two bar lists (network mix, tone
   distribution) and the streak calendar with **its own visible range label** ("last 90 days") plus
   one narrative line.

Ranges inside the tab differ on purpose and each says so. A bare number is the thing that is
forbidden, not a second range.

### Verification

- Playbook count and tone distribution match `/contexts` exactly. Change a Playbook's `tones` in
  `mocks.js` and the tab follows.
- Contrast: every text sample ≥ 4.5:1 (14px) against the `#F9F9FA` page background. **`grey-60`
  fails at 3.10:1** — use `--sys-text-color-light` (5.18:1) for secondary text.
- The gauge is not the only carrier of its value: the percentage is also text.
- No `title` attribute holds a figure. Data lives in the open or not at all.
- Keyboard: every interactive element reachable and focus-visible.

## Docs to update in the same change

`CLAUDE.md` requires docs to track the code.

- [`docs/reference/ROUTES.md`](../reference/ROUTES.md) — the `/insights/*` rows and the `/analytics`
  redirect.
- [`docs/reference/FEATURES.md`](../reference/FEATURES.md) — the hub is described there as one page.
- The Slite exploration log stays the living source of truth (linked from the spec).

## Working rules that already cost us time here

- **The `?v=` cache-buster is transitive.** Changing a module means bumping its `?v=` _and every
  importer's, up to `index.html`_. A cached importer keeps resolving the old child URL, so the browser
  runs a stale graph while `curl` serves the right file. Run `python3 scripts/bump-cache.py <files…>`;
  never bump by hand. This bit us twice — the second time silently: a new feature flag was invisible
  because `feature-flags.js` still imported a cached `ff-catalog.js`, and `isFlagOn` returns `false`
  for an unknown id. Verify with
  `grep -rho "<module>.js?v=[0-9]*" src/ index.html | sort -u` → exactly one version.
- **Design-system gate.** No raw hex, no `!important`, no redeclaring `.ap-*` rules. Reuse the DS
  component before writing CSS.
- **Comments.** `CLAUDE.md` bars: nothing that restates its line, one line each unless a constraint
  needs spelling out, at most one per function, describe the code as it stands, no section banners.
- **The local server** is `python3 -m http.server 8000` from the repo root (`.claude/launch.json` has
  an `archie` entry, but `preview_start` resolves `launch.json` from the cwd, so launching it by name
  fails from another worktree). It dies between sessions; restart it rather than debugging a dead port.

## Out of scope

- Voice and Team tabs beyond a placeholder.
- A Share button.
- Sortable table columns — a known open finding from the audit, deliberately left.
- Renaming the tier vocabulary (Strong / Watch / At risk).
- Fixing `portalModal()`.
