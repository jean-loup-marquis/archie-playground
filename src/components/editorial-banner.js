import { escapeText } from "../utils.js?v=38";

// Editorial lead — one warm sentence, at 24px, introducing the widgets under it.
//
// Every other analytics surface argues: this number vs that goal, this tier vs
// that one. This one just tells you what happened, in a sentence you could read
// aloud. It opens both the Analytics hub (portfolio numbers) and a Playbook's
// Performance section (that Playbook's own), which is why it lives here and not
// inside either screen — same technique, different scope.
//
// No card and no tiles: it is a lead-in, not a section. The numbers it alludes to
// are shown properly right below it as real Report Studio widgets, so restating
// them here as a second row of figures was saying everything twice.
//
// Public API:
//   renderEditorialBanner({ lead: { before?, highlight, after? } })
//   Returns "" for missing input so a caller can interpolate it blindly.

export function renderEditorialBanner(impact) {
  if (!impact?.lead?.highlight) return "";

  const { before = "Archie's been busy —", highlight, after = "" } = impact.lead;

  return `
    <p class="editorial-lead">
      <i class="ap-icon-quote" aria-hidden="true"></i>
      ${escapeText(before)}
      <strong class="editorial-lead__highlight">${escapeText(highlight)}</strong>
      ${escapeText(after)}
    </p>`;
}
