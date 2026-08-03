import { escapeText } from "../utils.js?v=21";

// Editorial banner — a warm one-sentence lead plus three narrated tiles.
//
// Every other analytics surface argues: this number vs that goal, this tier vs
// that one. This one just tells you what happened, in a sentence you could read
// aloud. It opens both the Analytics hub (portfolio numbers) and a Playbook's
// Performance section (that Playbook's own), which is why it lives here and not
// inside either screen — same technique, different scope.
//
// The `narrative` line under each tile is the whole point of the component: a
// raw total means nothing until it's a sold-out stadium three times over.
//
// Public API:
//   renderEditorialBanner({ lead: { before?, highlight, after? }, tiles })
//     tiles: [{ value, label, narrative }]
//   Returns "" for missing/empty input so a caller can interpolate it blindly.

export function renderEditorialBanner(impact, { modifier = "" } = {}) {
  if (!impact?.lead?.highlight || !impact?.tiles?.length) return "";

  const { before = "Archie's been busy —", highlight, after = "" } = impact.lead;

  const tiles = impact.tiles
    .map(
      (t) => `
      <div class="editorial-banner__tile">
        <span class="editorial-banner__value">${escapeText(t.value)}</span>
        <span class="editorial-banner__label">${escapeText(t.label)}</span>
        <span class="editorial-banner__narrative">${escapeText(t.narrative)}</span>
      </div>`,
    )
    .join("");

  return `
    <section class="editorial-banner${modifier ? ` ${modifier}` : ""}">
      <p class="editorial-banner__lead">
        ${escapeText(before)}
        <strong class="editorial-banner__highlight">${escapeText(highlight)}</strong>
        ${escapeText(after)}
      </p>
      <div class="editorial-banner__tiles">${tiles}</div>
    </section>`;
}
