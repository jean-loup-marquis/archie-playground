# vendor/

Third-party runtime code, committed rather than installed — this repo has no build
step, so a browser has to be able to `import` it straight off disk.

## highcharts

`highcharts-12.4.0.esm.js` — the ESM **core** build of Highcharts, copied verbatim from
`node_modules/highcharts/esm/highcharts.js`.

**Pinned to 12.4.0 to match platform** (`/platform/package.json` → `"highcharts": "12.4.0"`).
Report Studio's charts are configured against this major; a prototype on a different one would
drift silently. `npm install` pulls the same version as a devDependency purely so the copy can
be refreshed — nothing imports from `node_modules`.

The core is enough: `column`, `bar`, `pie` and `spline` all ship in it. `heatmap` and the world
map do **not** — they need `highcharts-more` / `highmaps` and are not used here.

Licence: Highcharts is commercial. Agorapulse holds a licence covering its use in platform, and
this repo is a private internal prototype of the same product surface.

### Updating

```bash
npm i -D highcharts@<version>
cp node_modules/highcharts/esm/highcharts.js vendor/highcharts/highcharts-<version>.esm.js
git rm vendor/highcharts/highcharts-<old>.esm.js
```

The version lives in the **filename** on purpose: a new version is a new URL, so no browser
serves a stale copy, and the one importer (`src/report-widgets/widget-chart.js`) has to be
updated deliberately rather than silently picking up a different build.
