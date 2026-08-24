// Objective alerts — what the user has already answered, and until when.
//
// The verdict itself is never stored: objective-scoring.js derives it from the
// numbers, so two surfaces can't disagree about whether an objective is off track.
// What IS stored is the only thing the numbers cannot tell you — whether the reader
// has already dealt with it, and until when.
//
// ── Why "muted", and not "done" ─────────────────────────────────────────────
// An objective does not recover because you acted on it. You draft, you publish,
// and then you wait for reach: days, in the best case. So acting cannot mean the
// alert disappears, and it cannot mean it stays either — a verdict that sits on the
// screen for a week while you do exactly what it asked is a nag, and the next one
// gets ignored with it.
//
// It means: don't ask me again before there is new evidence. So the state is muted
// UNTIL THE NEXT READ — the lane's own cadence — and every label says that rather
// than saying the objective is fixed. When the next read lands, the verdict is
// re-derived from fresh numbers: still off track, still surfaced.
//
// ── What counts as acting ───────────────────────────────────────────────────
// SENDING the message, not clicking the CTA. The click only fills the composer, and
// a filled composer is still a proposal — the reader can read the sentence, change
// their mind, and close the tab without having answered anything. `arm()` records
// which objective a session's composer is carrying; `commitArmed()` is called when
// that session sends, and mutes it.
//
// A reader who arms an alert and then sends something else entirely still counts as
// having acted: they went into the chat carrying that objective. Distinguishing the
// two would mean diffing composer text against a generated prompt, which is a lot
// of machinery to catch a case that costs nothing when it is wrong.
//
// Keys are `${playbookId}::${objective}` — an objective has no id of its own; it is
// a label on a Playbook (see objectiveCardsFor), so the pair is its identity.
//
// Public API:
//   alertState(playbookId, objective)  → "open" | "muted" | "aside"
//   isOpen(playbookId, objective)      → boolean
//   arm(sessionId, playbookId, objective)
//   commitArmed(sessionId)             → the muted key, or null
//   clearArmed(sessionId)
//   setAside(playbookId, objective)    the reader's own "not this cycle"
//   reopen(playbookId, objective)      back to open, from Insights
//   mutedUntilLabel(playbookId)        the copy for "until when"
//   subscribe(fn)                      → unsubscribe

import { createNotifier } from "./store-utils.js?v=14";
import { getLanes } from "./research-store.js?v=69";
import { findCadence, DEFAULT_CADENCE } from "./research-catalog.js?v=37";

const states = new Map(); // `${playbookId}::${objective}` → "muted" | "aside"
const armed = new Map(); // sessionId → { playbookId, objective }

const notifier = createNotifier("objective-alerts-store");
export const subscribe = notifier.subscribe;
const notify = () => notifier.notify(null);

function keyOf(playbookId, objective) {
  return `${playbookId || ""}::${objective || ""}`;
}

export function alertState(playbookId, objective) {
  return states.get(keyOf(playbookId, objective)) || "open";
}

export function isOpen(playbookId, objective) {
  return alertState(playbookId, objective) === "open";
}

/** Remember which objective this session's composer is carrying. */
export function arm(sessionId, playbookId, objective) {
  if (!sessionId || !playbookId || !objective) return;
  armed.set(sessionId, { playbookId, objective });
}

export function clearArmed(sessionId) {
  armed.delete(sessionId);
}

/**
 * Called when a session sends a message. Mutes whatever that session was carrying.
 * Returns the objective label so the caller can say what it just did, or null.
 */
export function commitArmed(sessionId) {
  const pending = armed.get(sessionId);
  if (!pending) return null;
  armed.delete(sessionId);
  states.set(keyOf(pending.playbookId, pending.objective), "muted");
  notify();
  return pending;
}

export function setAside(playbookId, objective) {
  states.set(keyOf(playbookId, objective), "aside");
  notify();
}

export function reopen(playbookId, objective) {
  if (!states.delete(keyOf(playbookId, objective))) return false;
  notify();
  return true;
}

// "until the next weekly read" — the cadence of the Playbook's own lane, because
// that is when new numbers actually arrive. Cadence is copy here as it is
// everywhere else in this prototype: no timer fires, and the label promises a next
// read rather than a date.
export function mutedUntilLabel(playbookId) {
  const lane = getLanes().find((l) => l.playbookId === playbookId);
  const cadence = findCadence(lane?.cadence || DEFAULT_CADENCE);
  return `until the next ${cadence?.adverb || "weekly"} read`;
}
