# Insights — Voice Block, Two Tabs, and the Gate: Implementation Plan

> **For agentic workers:** use the `executing-plans` skill to work through this task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Stop at each task's final commit for review before starting
> the next.

**Goal:** Fold the Voice tab's content into Usage as a third block, drop both the Voice and Team tabs,
and close the accessibility gate that the previous plan's Task 5 never ran.

**Architecture:** No new modules, and two fewer tabs. `usage.js` gains a third block; `shell.js` loses
the `voice` and `team` entries and both placeholder renderers; `#/insights/voice` and `#/insights/team`
redirect rather than 404. The hub ends at two tabs — Usage and Performance — which is where it stays.
The gate is a measurement pass over the whole hub, not a feature.

**Tech Stack:** Vanilla ES modules, no build step. Hash router (`src/router.js`). Agorapulse DS as CSS
classes. Prettier + husky/lint-staged on commit.

**Source documents:**

- **Spec:** [`docs/specs/2026-08-05-insights-tabs-design.md`](../specs/2026-08-05-insights-tabs-design.md) — decision 2 (amended) and "Block 3 — Your voice".
- **Predecessor plan:** [`docs/plans/2026-08-05-insights-tabs-plan.md`](2026-08-05-insights-tabs-plan.md) — steps 1–2, shipped as `5a79daf4` → `443e7414`. **Its Task 5 was never run; Task 2 below is that task, widened.**

**Scope:** the Usage voice block, removing both deferred tabs, and the gate. **Team is rejected, not
deferred** — the spec's "Team, and why it is not built" carries the reasoning; do not re-add it.

## Where the code actually is (verified 2026-08-05, head `443e7414`)

- `src/screens/insights/` holds `shell.js`, `performance.js`, `usage.js`. `styles/screens/insights.css`
  exists. `analytics.js` and `analytics.css` are gone.
- `shell.js` declares four tabs; `voice` and `team` render `renderVoicePlaceholder()` /
  `renderTeamPlaceholder()`.
- `ROUTES.md`, `FEATURES.md` and the `rootAnalytics` flag prose were updated — nothing to redo there
  beyond the tab count.
- No `title` attribute holds a figure in any Insights module. That constraint held.
- Two bugs were fixed during implementation that this plan must not reintroduce: listeners were
  stacking on every tab navigation (`b3f0a083`), and the streak calendar was unreadable (`443e7414`).
  Read both diffs before touching `shell.js` or the calendar.

## Global Constraints

Every task's requirements implicitly include this section.

- **The `?v=` cache-buster is transitive.** Run `python3 scripts/bump-cache.py <changed files…>`. Never
  bump by hand. Verify with `grep -rho "<module>.js?v=[0-9]*" src/ index.html | sort -u` → one version.
- **Contrast floor.** ≥ 4.5:1 at 14px. `--ref-color-grey-60` fails: **3.26:1 on white**, 3.10:1 on the
  `#F9F9FA` page background. Use `--sys-text-color-light` (5.18:1).
- **Design-system gate.** No raw hex, no `!important`, never redeclare an `.ap-*` rule.
- **No figure in a `title` attribute.**
- **Never mock what can be derived.**
- **No randomness in `src/mocks.js`.**
- **Comment bars (`CLAUDE.md`).** Nothing that restates its line; one line each unless a constraint
  needs spelling out; at most one per function; describe the code as it stands; no section banners.
- **English** for code, comments and commit messages.

## Verification, and what it is not

Still no test framework, still the granted throwaway-prototype exception (see the predecessor plan for
the terms and the cost). Each task writes a browser assertion, watches it fail, implements, watches it
pass, commits.

```bash
npm start   # npx serve -p 8000
```

Then `http://localhost:8000/#/insights/usage`. Paste once per session:

```js
const check = (label, actual, expected) =>
  console.log(
    JSON.stringify(actual) === JSON.stringify(expected)
      ? `PASS ${label}`
      : `FAIL ${label} → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`,
  );
```

`portalModal()` at `src/playbook-view.js:2117` is still undefined and still kills every click handler in
the Playbook detail panel. Baseline, not yours, do not fix it here.

---

### Task 1: The "Your voice" block, and the hub drops to two tabs

**Files:**

- Modify: `src/mocks.js`, `src/screens/insights/usage.js`, `src/screens/insights/shell.js`, `src/app.js`, `styles/screens/insights.css`, `docs/reference/ROUTES.md`, `docs/reference/FEATURES.md`, `src/ff-catalog.js`

**Interfaces:**

- Consumes: `archieUsage()` from `mocks.js`, extended with a `voice` key.
- Produces: `archieUsage().voice → { favouriteTone: string, toneRunnerUp: string, favouriteHook: { text, uses }, signatureWord: string, alwaysAvoid: string }`. No new exported function — the block is internal to `usage.js`.

- [ ] **Step 1: Write the failing assertion**

On `#/insights/usage`:

```js
check("two tabs", document.querySelectorAll(".ap-tabs-tab").length, 2);
check(
  "no Voice or Team tab",
  [...document.querySelectorAll(".ap-tabs-tab")].map((t) => t.textContent.trim()),
  ["Usage", "Performance"],
);
check("voice block renders", !!document.querySelector(".insights-voice"), true);
check("four superlatives", document.querySelectorAll(".insights-voice .recap__widget").length, 4);
```

- [ ] **Step 2: Run it and verify it fails**

Expected: 4 tabs including Voice and Team, no `.insights-voice`. All four FAIL.

- [ ] **Step 3: Add the data to `archieUsage()`**

Inside the existing `ARCHIE_USAGE` object in `src/mocks.js`, alongside `produced` and `work`:

```js
  // Pure flattery, and honest about it — the register of Wispr's "Your voice",
  // describing the operator rather than a brand. That subject is what makes it
  // agnostic to how many brands the account runs: an agency operator still has
  // habits across fourteen clients.
  //
  // Every figure here needs a frequency the platform does not record. `tones`
  // counts Playbooks, not posts, and ties 2–2 across the four seeded ones, so a
  // favourite has no winner without post-level counts. See the spec's data table.
  voice: {
    favouriteTone: "Direct",
    toneRunnerUp: "Conversational",
    favouriteHook: { text: "Unpopular opinion:", uses: 34 },
    signatureWord: "shipped",
    alwaysAvoid: "Emoji in B2B posts",
  },
```

- [ ] **Step 4: Render the block in `usage.js`**

First, `renderMiniWidget` does **not** tolerate a missing `variation` — verified: `undefined >= 0` is
false, so it renders a stagnate arrow and the string `undefined%`. Two of the four superlatives have no
trend, so guard the variation row in `src/components/report-widget.js`:

```js
const hasVariation = typeof w.variation === "number";
```

and wrap the existing `.recap__overview-variation` div in `${hasVariation ? \`…\` : ""}`. Do **not**
pass `variation: 0` instead — that renders a flat-trend arrow, which claims a measurement that does not
exist.

Then in `usage.js`, destructure `voice` from `archieUsage()` and add this helper plus a call to it in
the returned template, after the "How you work" section:

```js
function renderVoiceBlock(voice) {
  const cards = [
    { title: "Favourite tone", value: voice.favouriteTone, narrative: `${voice.toneRunnerUp} runs a close second.` },
    {
      title: "Favourite opening",
      value: `\u201C${voice.favouriteHook.text}\u201D`,
      narrative: `Used ${voice.favouriteHook.uses} times.`,
    },
    { title: "Signature word", value: `\u201C${voice.signatureWord}\u201D` },
    { title: "Always avoided", value: voice.alwaysAvoid },
  ];
  return `
    <section class="insights-view__section">
      <h2 class="insights-view__section-title">Your voice</h2>
      <div class="insights-voice">${cards.map((c) => renderMiniWidget(c)).join("")}</div>
    </section>`;
}
```

A helper rather than four inline calls: the section is a list of four equal things, and writing it as a
list is what stops a fifth one being pasted in with a different shape.

- [ ] **Step 5: Style the block**

In `styles/screens/insights.css`:

```css
/* Four superlatives, equal weight — none of them is the headline, and none of
   them is a trend, so they get no gauge and no chart. */
.insights-voice {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--ref-spacing-sm);
}

@media (max-width: 900px) {
  .insights-voice {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

- [ ] **Step 6: Drop both tabs and redirect their URLs**

In `shell.js`, delete the `voice` and `team` entries from `TABS`, and delete both
`renderVoicePlaceholder()` and `renderTeamPlaceholder()`. `renderEmptyState` may become an unused
import — remove it if so.

In `src/app.js`, add the redirects above the `/insights/:tab` route:

```js
// Both tabs existed for half a day; their URLs may have been shared.
route("/insights/voice", () => {
  navigate("/insights/usage");
  return () => {};
});
route("/insights/team", () => {
  navigate("/insights/usage");
  return () => {};
});
```

Team is **rejected, not postponed** — see the spec. Do not leave a commented-out entry behind: a
commented tab is an invitation to uncomment it without reading why it went.

Confirm the shell's unknown-tab fallback still catches everything else: `#/insights/nonsense` must land
on Usage without a console error.

- [ ] **Step 7: Update the docs**

`ROUTES.md` — the `/insights/:tab` row lists the tabs; make it two and add both redirects.
`FEATURES.md` — same count, the Usage tab now has three blocks, and Team is recorded as rejected rather
than upcoming. `src/ff-catalog.js` — the
`rootAnalytics` prose names the tabs; **keep the flag id**.

- [ ] **Step 8: Bump, format, run the assertion**

```bash
python3 scripts/bump-cache.py src/mocks.js src/screens/insights/usage.js src/screens/insights/shell.js src/app.js src/components/report-widget.js
npx prettier --write src/screens/insights src/mocks.js src/app.js styles/screens/insights.css docs/reference
```

All four checks PASS. Then: `#/insights/voice` lands on Usage; the Performance tab still shows 4 health
cards and 8 rows; the CTA still opens the drawer from both remaining tabs and returns focus on Esc.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(insights): Voice becomes a Usage block, not a tab

Designing the tab is what killed it. Voice turned out to be pure flattery — a
favourite tone, a favourite opening — which is the same register as Usage. Two
delight tabs beside one useful tab is a lopsided hub, and putting the pleasant part
behind its own tab asks the reader to go looking for it when the whole point of
Usage landing first was that it greets them.

The subject is the operator, not the brand. That is what makes the block agnostic to
how many brands the account runs, and it is why three earlier attempts failed:
averaging tones across brands is noise the moment an agency runs fourteen clients,
and grouping by brand implied a consistency verdict the data cannot support — the two
Acme Playbooks differ on all ten voiceProfile dimensions, every difference sensible.

Every figure needs a frequency nothing records: tones count Playbooks rather than
posts and tie 2-2 across the four seeded ones, so a favourite has no winner. Carried
in the spec's data table as instrumentation to request, not smuggled in as fact.

/insights/voice redirects — the tab existed long enough for a URL to be shared."
```

---

### Task 2: The accessibility gate the previous plan never ran

The predecessor plan's Task 5 was skipped. It matters more than it did then, because a measurement pass
now covers both tabs and the new block — and because there are already three known failures.

**Files:**

- Modify: `styles/screens/insights.css`, plus whatever the measurements find.

- [ ] **Step 1: Fix the three known contrast failures**

`grep -n "ref-color-grey-60" styles/screens/insights.css` returns three `color:` declarations on text —
`.analytics-card__none`, `.analytics-row__goal`, `.analytics-trend`. All three fail (3.26:1 on white).
Swap each for `--sys-text-color-light`. Do not invent a colour.

`.analytics-trend` is the one that matters: its `is-up` / `is-down` variants override the colour, so only
the **flat** trend cells were failing — which is exactly why a selector-sampled audit missed them. The
previous audit checked `.analytics-trend.is-down` and passed it.

- [ ] **Step 2: Run the full measurement, walking every text node**

On each of `#/insights/usage` and `#/insights/performance`:

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
    .map((e) => ({ text: e.innerText.trim().slice(0, 34), ...ratio(e) }))
    .filter((r) => !r.pass),
);
```

An empty table on **both** routes is the pass condition. Fix every row it lists.

The objective table needs a row in each tier for full coverage — filter to "Strong only" and back, so
`.analytics-trend` renders in all three states.

- [ ] **Step 3: Check the keyboard path across the hub**

Tab through both tabs. Every control reachable, focus visible, the tab nav operable with Enter. The
eight objective-table rows must be reachable via the `.analytics-row__open` buttons. Nothing
mouse-only.

- [ ] **Step 4: Check for hidden data and DS violations**

```bash
grep -rn "title=" src/screens/insights/          # expect no figures
grep -n '#[0-9a-fA-F]\{3,8\}\b\|!important' styles/screens/insights.css   # comments only
```

- [ ] **Step 5: Re-read the diff against the comment bars**

`git diff HEAD~1` — delete any comment that restates its line, runs past one line without spelling out a
constraint, appears twice in one function, or narrates a change.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(insights): close the accessibility gate, and the contrast the audit missed

Three grey-60 text colours were failing at 3.26:1 on white: the empty-Playbook
line, the objective goal, and the flat trend cell. The flat trend is the
interesting one — is-up and is-down override the colour, so only the flat state
failed, and a selector-sampled audit passed the is-down variant and never tested
the base class. This pass walks every text node instead."
```

---

## Out of scope

- **Re-adding Team in any form.** It was rejected on 2026-08-05, not deferred: it contradicts the
  standing "no cross-account/team consolidation" limit the Report Studio bridge argues from, and nothing
  in the prototype carries multi-user data. The nearest keeper is the anonymised "Vs. peers" benchmark,
  which compares outside the organisation rather than inside it — unscheduled.
- **Sortable table columns.** Still open from the audit: the table says "worst first" but its headers
  are not clickable.
- **The tier vocabulary** (Strong / Watch / At risk).
- **`portalModal()`**.
- **A test framework.** The exception still stands; `objective-scoring.js` is still uncovered.

## Self-review of this plan

- **Spec coverage.** Decision 2 as amended, and "Block 3 — Your voice" including the rejected framings,
  map to Task 1. The spec's new data-table rows are reflected in the mock's comment. Task 2 covers the
  predecessor's unrun Task 5.
- **Placeholder scan.** None.
- **Interface consistency.** `archieUsage().voice` is used under that name in Steps 3 and 4;
  `renderMiniWidget` keeps the `{ title, value, narrative }` shape Task 3 of the predecessor plan
  introduced, with the `variation` guard called out explicitly because this is the first caller to omit
  it.
