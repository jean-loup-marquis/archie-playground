# Insights — tabbed hub with a usage tab (design)

**Status:** design converged with the PM 2026-08-05, ready for an implementation plan. Successor to
[`docs/plans/2026-08-03-analytics-root-hub-plan.md`](../plans/2026-08-03-analytics-root-hub-plan.md),
which built the single-page hub this design restructures.

**Source of truth (living doc — this spec is a snapshot):**
[Root Analytics Hub — Exploration Log](https://agorapulse.slite.com/app/docs/v3n22S0GKvdZF1), child of
[Analytics in Archie](https://agorapulse.slite.com/app/docs/4_6D6nK5uw).

**Reference:** Wispr Flow's _Insights_ screen (`Your usage` / `Your voice` / `Leaderboard`) — the
tabbed structure and the narrated-metric treatment come from there.

## Problem

The hub built on 2026-08-03 is one stacked page: editorial lead, four report widgets, a health card
per Playbook, a filterable objective table, the Report Studio bridge. Two things are wrong with it.

**It only ever argues.** Every element compares a number to a goal, a tier, or an industry median.
Nothing in Archie's own root surface tells the user what Archie _did for them_ — which, for an
AI-native content tool, is the thing that justifies coming back. A heuristic audit of the page
(2026-08-05, two passes, scored 5/10 before fixes) found the page had no obvious primary action and
contradicted itself; both were fixed, but the page is still wall-to-wall performance analysis.

**One page cannot hold more.** Adding usage metrics to the same scroll would make an already dense
page denser, and `src/screens/analytics.js` is ~420 lines before any addition.

## Decisions

Every decision below was taken with the PM in session. Where a decision overrides an earlier one,
that is called out — the earlier reasoning is not wrong, its premise changed.

| #   | Decision                                                                   | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The nav entry becomes **Insights**, the page's H1 becomes **Insights**     | "Analytics" as both the nav entry and a tab inside it is what made the PM report a missing "Performance" entry earlier. The container and its contents must not share a name. Also mirrors Wispr.                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | **Two tabs: Usage · Performance**                                          | _Amended twice on 2026-08-05, as each deferred tab got designed._ **Voice** turned out to be pure flattery — same register as Usage — so it became a third Usage block rather than a lopsided fourth tab. **Team was dropped outright**: this log already lists "no cross-account/team consolidation" among the deliberate limits the Report Studio bridge argues from, so building it inside Archie would contradict a standing decision. Nothing multi-user exists in the prototype either. The nav survives at two because the two jobs are genuinely distinct — welcome, then triage. At one tab it goes. |
| 3   | **Usage is the landing tab**                                               | Chosen over performance-first. The PM's call: the hub should welcome before it triages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 4   | The **objective-triage CTA stays global**, in the header above the tab nav | Resolves the tension decision 3 creates. A user who never leaves Usage still sees that N objectives are slipping, and clicking opens the drawer without changing tab.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 5   | **No global period line.** Each tab states its own                         | _Overrides the audit fix that put "Last 30 days" in the header._ That fix was right for one page; with tabs, Usage is deliberately long-history (it is the fun surface) while Performance stays bounded. The invariant is not "one period per page" but **no number without a stated period**.                                                                                                                                                                                                                                                                                                                |
| 6   | **Shell + one module per tab**                                             | `analytics.js` would reach ~1500 lines otherwise. See Architecture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 7   | **One URL per tab**                                                        | The router is already hash-based, so it costs almost nothing and it keeps the browser back button and shareable links working.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | **No Share button**, despite Wispr's                                       | Sharing dictation stats is harmless; these numbers touch a brand's commercial performance. It deserves its own thinking, not a copy-paste.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 9   | Page-level names follow the page, thing-level names do not                 | New files and page classes become `insights-*`; `analytics-card`, `analytics-row`, `analytics-trend` stay — they name a health card and an objective row, not the page. Avoids renaming ~40 classes for nothing.                                                                                                                                                                                                                                                                                                                                                                                              |

## Architecture

```
src/screens/insights/
  shell.js        the only module that knows about the nav
  usage.js        tab 1 — what Archie produced + how you work + your voice
  performance.js  tab 2 — verbatim extraction of today's analytics.js
```

**`shell.js`** renders the header (H1, the global CTA) and the `.ap-tabs-nav`, then delegates to the
active tab's `render()`. It holds the tabs in a declarative table — `{ id, label, icon, render }` —
so adding or removing a tab is one line. It knows tab _names_, never tab _content_.

**Each tab module exposes `render()` and nothing else.** A tab can be built, read and reviewed
without opening any other. `performance.js` is a move, not a rewrite: today's page body goes in
unchanged, including the Report Studio bridge, which belongs where it argues.

**Routing.** `#/insights` redirects to `#/insights/usage`; the two tabs are `usage` and `performance`.
`#/analytics`, `#/insights/voice` and `#/insights/team` all redirect to `#/insights/usage` — the first
predates the rename, the other two existed long enough for a URL to be shared.

**The action drawer is untouched.** It owns its own document-level delegation via
`[data-open-action-drawer]`, so the shell's CTA works with no wiring, and the second door inside
`playbook-view.js` keeps working as-is.

**DS reuse.** The tab nav is `.ap-tabs` / `.ap-tabs-nav` / `.ap-tabs-tab`, already used in
`src/components/content-workspace.js` (icon + label + `.ap-counter`). Nothing to invent.

**No counter on the tabs.** Considered and rejected: a "5" on the Performance tab, which holds 8
objectives, reads as "5 objectives" — the exact trap that made us remove the sidebar's Analytics
badge (two adjacent badges counting different things). The count lives once, on the CTA.

## Tab 1 — Usage

Validated as a mockup with the PM — kept alongside this spec at
[`assets/2026-08-05-insights-usage-layout.html`](assets/2026-08-05-insights-usage-layout.html)
(open it in a browser; the `B` / `C` tags mark which reference each piece came from).
Three blocks under their own subheadings, familiar card chrome plus one signature piece. The third
arrived on 2026-08-05, when Voice lost its tab.

**Editorial lead**, full width, serif, one sentence with the figure in accent colour:
_"Archie a écrit 148 200 mots pour toi ce mois-ci — de quoi publier chaque semaine pendant deux ans."_
Same technique as the existing `editorial-banner` component; reuse it rather than a second variant.

**Block 1 — "What Archie produced"**: a gauge card plus three metric cards, each carrying one
narrative line.

- **Gauge: drafts kept without editing (71%).** The gauge is reserved for this one rate. A gauge
  expresses a part of a whole, so putting one on a volume like "2,431 drafts" would be a visual lie.
  It is also the most honest signal of Archie's actual output quality.
- Drafts generated, posts published, sources digested — flat numbers with a narrative line each.

**Block 2 — "How you work"**: two cards side by side.

- **Bar lists**: where you publish (network mix) and which tone recurs (across Playbooks). A tone
  shown as a single value says nothing; three tones distributed over four Playbooks says something
  about the brand.
- **Streak calendar**, ~90 days, with its **own visible period label** so it does not contradict
  Performance's 30 days, plus one narrative line ("your Tuesday is your most productive day").

**Ranges inside the tab differ, and each says so.** The lead is a month, the calendar is ~90 days,
the volume cards are a month. That is not a contradiction as long as every one of them carries its
range — which is the invariant from decision 5, applied within a tab rather than across the page. What
is forbidden is a bare number.

### Block 3 — "Your voice"

Pure flattery, and honest about it: it informs nothing and is not meant to. Four superlatives, no
verdict, no comparison — the register of Wispr's _Your voice_, which describes the person rather than
the brand.

**Subject is the operator, not the brand.** That is what makes the block brand-agnostic by
construction, and it is the reason three earlier attempts failed. Averaging tones across brands is
noise the moment an agency runs fourteen clients ("you write direct and conversational" is meaningless
across fourteen voices); grouping by brand fixed that but over-fitted to four fixture Playbooks and
implied a consistency verdict the data cannot support. Describing the operator's own habits sidesteps
all of it — an agency operator does reach for the same tone and the same opening, across every client.

The four figures: **favourite tone** · **favourite hook** · **signature word** · **what you always
avoid**. Each one number or one quote, no bar chart, no trend.

**Rejected:** any "consistency" or "voice drift" framing. Playbooks of one brand legitimately differ
by audience and objective — the two Acme Playbooks share identical objectives and differ on all ten
`voiceProfile` dimensions, every difference sensible. A flag there would only produce false positives,
and detecting a real contradiction ("no emoji" vs "emoji encouraged") needs semantic comparison
nothing here supports.

**No "Top 0.4%"** as Wispr has. Ranking one brand against others is meaningless here, and the Team
tab already covers the appetite for comparison.

**Narrative lines on the metric cards only** — not on the gauge or the calendar, which already speak
for themselves.

## Data model

The rule: **never mock what can be derived.** A mocked figure that contradicts the real Playbook list
is the same class of defect the audit just charged us for.

**Derivable today — must be computed at render, not mocked:**

| Figure                             | Source                                                      |
| ---------------------------------- | ----------------------------------------------------------- |
| Playbooks active                   | `getContexts().length`                                      |
| Tone distribution                  | `contexts[].tones`, counted across Playbooks                |
| Everything on the Performance tab  | already built (`objectiveCardsFor`, `objective-scoring.js`) |
| Voice profile per Playbook (tab 3) | `contexts[].voiceProfile`, `voiceAnalysis`                  |

**Not available — to be provided by the platform.** This list is a deliverable of the PRD, not an
obstacle to the prototype: mock it here, and hand the requirement over.

| Figure                                              | Why it is missing                                                                                                                                  | Severity for the tech team             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Drafts generated, posts published, sources digested | The data exists but is **session-scoped and lazily seeded** (`getPosts(sessionId)`), so a portfolio total would only count sessions already opened | Aggregation problem — the events exist |
| Network mix                                         | Same session-scoping as above                                                                                                                      | Aggregation problem                    |
| Words written by Archie                             | No aggregate anywhere                                                                                                                              | Aggregation problem                    |
| **Drafts kept without editing (%)**                 | **Nothing records whether a draft was edited after generation**                                                                                    | New instrumentation required           |
| **Creation streak / activity calendar**             | **No timestamp of creation activity is stored**                                                                                                    | New instrumentation required           |
| **Hook usage frequency** (block 3)                  | **Nothing counts how often a signature hook is actually used** — so "favourite" is undecidable, only "your hooks" is                               | New instrumentation required           |
| **Tone frequency by post** (block 3)                | `tones` counts Playbooks, not posts. Four Playbooks tie 2–2 on Direct and Conversational, so a superlative has no winner                           | New instrumentation required           |
| **Signature word** (block 3)                        | Requires counting words across published posts                                                                                                     | Aggregation over existing post text    |

The instrumentation rows are the most attractive figures in the tab and the furthest from reality.
Expect them to be the first thing a developer questions. Block 3 is the worst offender: it promises the
most and rests on the least, which is the price of a section whose only job is to be pleasant.

**Shape.** One `archieUsage()` export in `src/mocks.js`, mirroring the existing `archieImpact()` —
figures and their narrative strings in one place, plus a static deterministic array for the calendar.
No `Math.random`: the file forbids randomness by design, and a shifting calendar would make screenshots
non-reproducible.

## Build order

Each step ships on its own.

1. **Shell + Performance extraction.** No visible change beyond the rename and the tab nav appearing
   with one populated tab. Everything keeps working — this is the risky step, so it lands alone.
2. **Usage tab.** The design above.
3. **The "Your voice" block** inside Usage, dropping both the Voice and the Team tabs.

**Steps 1 and 2 shipped on 2026-08-05** (commits `5a79daf4` → `443e7414`). Step 3 is specified below
and planned in
[`docs/plans/2026-08-05-insights-voice-block-plan.md`](../plans/2026-08-05-insights-voice-block-plan.md).
The Team tab was **rejected** on 2026-08-05 rather than deferred again — see decision 2 and the
"Team, and why it is not built" section below.

## Team, and why it is not built

**Rejected 2026-08-05.** Wispr's Leaderboard was the reference, and it does not transfer.

- **It contradicts a standing decision.** The exploration log lists "no cross-account/team
  consolidation" among the _arbitrary_ limits — the ones chosen deliberately — that the Report Studio
  bridge argues from. Shipping team consolidation inside Archie would remove an argument we decided to
  keep.
- **The comparison is not the same kind of comparison.** Ranking dictation speed between colleagues is
  harmless fun; ranking a marketer's brand performance against a colleague's is performance-review
  data. The register that makes Wispr's leaderboard pleasant is exactly what makes this one hostile.
- **Nothing in the prototype carries it.** No colleagues, no seats, no members — one hardcoded user in
  the sidebar. It would have been the only surface built on 100% invented data.

**The nearest idea worth keeping** is already in the log: the anonymised _"Vs. peers"_ benchmark —
comparing a Playbook against an aggregate of other Archie accounts in the same vertical. That compares
outside the organisation rather than inside it, which is the distinction that matters. Still a bigger
bet needing user density per vertical and a real anonymisation design; unscheduled, not adopted here.

## Out of scope

- The Share button (decision 8).
- Sortable table columns. The objective table says "worst first" but its headers are not clickable —
  a known finding from the audit, left open deliberately, not forgotten.
- Tier vocabulary. "Watch" is the weakest of Strong / Watch / At risk, but renaming a tier is a
  product decision, not a refactor.

## Docs to update when implementing

- [`docs/reference/ROUTES.md`](../reference/ROUTES.md) — the `/insights/*` table entries and the
  `/analytics` redirect.
- [`docs/reference/FEATURES.md`](../reference/FEATURES.md) — the hub is described there as a single
  page.
- `src/ff-catalog.js` — the `rootAnalytics` flag description names an "Analytics hub".
- The Slite exploration log, which stays the living source of truth.
