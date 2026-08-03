# Analytics root hub in Archie — implementation plan

**Status:** design converged, ready to prototype. Written 2026-08-03 to hand off a fresh conversation without losing context from the brainstorming session that produced it.

**Source of truth (living doc, keep reading it — this plan is a snapshot):** [Root Analytics Hub — Exploration Log](https://agorapulse.slite.com/app/docs/v3n22S0GKvdZF1), child of [Analytics in Archie](https://agorapulse.slite.com/app/docs/4_6D6nK5uw).

## Goal

Bring analytics to the **root of Archie** (not just inside a single Playbook's detail), as a new "Analytics" entry in Archie's own sub-nav. Must work standalone for Archie-only users (no Agorapulse subscription) — that's the whole point: Archie is a PLG/self-serve surface, and the existing "Analytique" nav entry in the product shell is Agorapulse-only.

Three-layer structure:

1. **Playbook detail** (existing, unchanged) — the objective triptych (target/baseline/benchmark + verdict), already implemented in `src/playbook-view.js`.
2. **Archie root hub** (this plan) — new, aggregates across playbooks, self-contained.
3. **Report Studio / "Analytique"** (existing, Agorapulse-only) — bridged from both layer 1 and layer 2 for hybrid users, never a replacement.

PLG framing: Archie should bridge to Agorapulse as broadly as possible, but discreetly — enough for a mid-market prospect with reporting needs to sense the depth available, not so much a solo creator ever needs it.

## Technical grounding (verified in this repo, 2026-08-03)

- `src/screens/playbook.js` / `src/playbook-view.js` — the objective triptych already exists ("Goals & Objectives" section, `objectiveCardsFor()` + `OBJECTIVE_METRICS` in `src/mocks.js`). Reuse this data shape.
- `src/mocks.js` — `OBJECTIVE_METRICS` currently hand-authors `status: "on-track" | "watch"` per objective (only 2 states, no formula). This plan introduces a 3rd tier ("at-risk") and a **computed** formula (below) rather than hand-authored status — verified the formula reproduces all 4 existing entries exactly, so it's a safe drop-in.
- `src/contexts-store.js` — `getContexts()` returns all Playbooks (4 seeded), each with an `objective: string[]` array (can be multi-objective, e.g. `["Brand awareness", "Lead generation"]`).
- `src/components/sidebar.js` — nav is a declarative `NAV` array (`{ path, icon, label, match, count }`). Add a new entry here for "Analytics", no structural rework needed.
- `src/app.js` — routes are `route("/path", handler)` calls. Add `route("/analytics", renderAnalytics)`.
- **DS convention in this repo (different from the platform monorepo!):** classes `.ap-*` + tokens `--ref/sys-*`, **no Angular components** — everything is vanilla JS + `html` tagged templates (see `utils.js`). Do not reach for `<ap-status>`/`ap-widget-card`/Angular patterns from the platform prototype; they don't exist here and must be rebuilt in css-ui + tokens.

## Data layer — scoring formula (new)

Add a small pure module, e.g. `src/objective-scoring.js`:

```js
// Per-objective verdict: base tier from progress-to-goal, downgraded one notch
// on a flat/declining trend. benchmark stays informational, never gates the tier.
export function objectiveTier(progress, variationPercent) {
  let tier = progress >= 80 ? "strong" : progress >= 60 ? "watch" : "at-risk";
  if (variationPercent <= 0) tier = tier === "strong" ? "watch" : "at-risk";
  return tier;
}

// Effective score used for the playbook aggregate — same trend penalty,
// so the ring and the chips never contradict each other.
export function effectiveScore(progress, variationPercent) {
  const penalty = variationPercent <= 0 ? 15 : 0;
  return Math.max(0, Math.min(progress, 100) - penalty);
}

// Playbook aggregate score = equal-weight average of its objectives' effective
// scores. Same thresholds as objectiveTier for the label.
export function playbookScore(objectives) {
  const scores = objectives.map((o) => effectiveScore(o.progress, o.variationPercent));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const tier = avg >= 80 ? "strong" : avg >= 60 ? "watch" : "at-risk";
  return { score: Math.round(avg * 10) / 10, tier };
}
```

Open assumptions (documented, not hidden): equal weight per objective (v1); the −15 trend penalty is a round starting value, not calibrated. Both are stated in the Slite log.

## Screens & components to build

### 1. `/analytics` route + `src/screens/analytics.js`

Renders the hub page, top to bottom:

1. **Editorial banner** — one headline sentence (e.g. "Archie's been busy — **42,300 people reached** this month, and your engagement is beating the industry average.") + 3 tiles below a divider, each with number + label + a short narrative line (e.g. "That's a sold-out stadium, three times over."). Numbers are aggregated across all playbooks (illustrative in exploration; wire to real aggregation later — reach/posts-via-Archie/engagement aren't currently aggregated anywhere in this repo, that's new). **Build this as a small reusable component (e.g. `src/components/editorial-banner.js`), not inlined in `analytics.js`** — see "Also retrofit onto the Playbook detail" below, it gets reused there with different (single-playbook) numbers.
2. **Playbook health cards** — one card per Playbook (`getContexts()`), grid layout. Each card: a ring gauge (annular, not a filled disc) showing `playbookScore().score` with the tier color, a status label (Strong/Watch/At risk), and a row of chips — one per objective, muted grey by default, colored (amber/red) when its tier isn't "strong". No action buttons on the card itself.
3. **Objective table** — flat, one row per objective across all playbooks (flatten `getContexts()` × `objectiveCardsFor()`). Columns: Playbook (name + color dot) · Objective · Progress · Status (pill) · Trend (30d) · Benchmark. A playbook filter dropdown + a status filter dropdown ("All" / "Needs attention" / "Strong only") above the table. Default sort: at-risk → watch → strong. No action column — actions live in the drawer (below). Flagged rows get a 3px colored left inset border (new pattern, not in the existing DS — fine to introduce, documented as a deliberate DS extension).
4. **Report Studio bridge** — one slot, two states depending on an entitlement flag (mock a `hasAgorapulse` flag/toggle for now, there's no real entitlement check in this repo):
   - Without: muted/locked treatment, leads with the _structural_ argument ("Compare Archie posts to everything else you publish — needs visibility into all your content, available with Agorapulse"), single "Learn more" CTA.
   - With: functional treatment, "Add this playbook to a Report Studio report" CTA (can just be a stub action for the prototype — no real Report Studio integration exists in this repo).

### 2. Shared action drawer — `src/components/action-drawer.js`

One reusable component (vertical panel, slides from the right), invoked from two trigger points:

- A badge/icon button (⚡ + count) near the "Analytics" hub page header.
- The same badge/icon button inside a Playbook's Goals & Objectives section (in `playbook-view.js`).

Drawer content = one row per flagged objective (not "strong" tier), each showing: playbook name, objective, short diagnosis, 1–2 recommended action buttons (buttons can be inert/stubbed for the prototype — see lever catalog below).

**Scope behavior:** opened from inside a Playbook → defaults to "This playbook" (filtered), with a toggle to "All playbooks". Opened from the hub → defaults to "All playbooks", same toggle to narrow down.

### 3. Lever catalog + routing table (static data, no real integrations needed for the prototype)

Routing table (objective/metric type → recommended lever labels to show as buttons in the drawer):

| Signal                                  | Primary lever(s)                                                       |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Reach/awareness stagnating or declining | "Reshare top post" · "Repurpose cross-platform" · "Boost with ads"     |
| Engagement rate flat or declining       | "Reply to comments" · "Rebalance format mix"                           |
| Audience/follower growth stalling       | "Push via Ambassador" · "Reshare to new segments"                      |
| Lead gen/CTA clicks below goal          | "Get content ideas" (→ Content Ideation, if built) · "Test a new hook" |

These are **prototype-only stub buttons** — none of the underlying mechanisms (Ambassador integration, paid boost, native resurface/reshare, Content Ideation) exist in this repo. Clicking can just show a toast ("Not built yet") for now.

## Also retrofit onto the Playbook detail (new, 2026-08-03)

The editorial banner isn't root-hub-exclusive. It should also introduce the **Performance section already built inside a Playbook's detail view** (`playbook-view.js`, the objective cards + pinned-widgets mini-report from the earlier `prototype/playbook-page-archie` work in the platform monorepo) — a short narrative sentence ahead of the widgets grid, same technique, just scoped to that one playbook's numbers instead of the portfolio-wide ones. No new data, no new mechanic — reuse the same `editorial-banner.js` component from the hub with different inputs. This makes the two Performance surfaces (root hub and Playbook detail) read as one coherent product instead of two different treatments. Documented in the Slite exploration log and in memory (`project_playbook_analytics_proto` note) — not yet implemented anywhere.

## Build order

1. `objective-scoring.js` (data layer, no UI) — quick to verify against the 4 existing mock objectives.
2. Sidebar nav entry + route + empty `analytics.js` screen shell.
3. Health cards section (reuses scoring module + `getContexts()`).
4. Objective table section.
5. Editorial banner (numbers can be hardcoded/illustrative at first).
6. Report Studio bridge (two states, mock entitlement toggle).
7. Action drawer component + wire its two trigger points (hub header, then inside `playbook-view.js`'s Goals & Objectives section).
8. Retrofit the editorial banner component onto `playbook-view.js`'s Performance section (single-playbook numbers) — see "Also retrofit onto the Playbook detail" above.

Work on a `proto/analytics-root-hub` branch (never `main` — this repo mirrors upstream + a daily sync workflow). Not mergeable; the point is to hand off a clickable spec, same pattern as the earlier `prototype/playbook-page-archie` work in the platform monorepo.

## Explicitly out of scope for this prototype pass

- Real Report Studio integration (the "Add to report" CTA is a stub).
- Real lever mechanisms (Ambassador push, paid boost, native resurface/reshare, Content Ideation deep-link) — buttons exist, behavior is stubbed.
- Cross-tribe Content Ideation contract (still open per the Slite log).
- Real entitlement/subscription check (mock a toggle instead).
