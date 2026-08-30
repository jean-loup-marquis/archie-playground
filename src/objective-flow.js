// Launches the in-chat interaction for an OBJECTIVE — the loop's exit (PP
// "Objectives in Archie", key flow 4: steered → acted).
//
// The Insights detail ends on one Next move; its CTA opens a chat pre-loaded
// with the objective, and Archie's first turn carries the diagnosis and the
// angles that answer the weak measure. Same two-half shape as topic-flow.js,
// and for the same reason — the entry point and the choreography live on
// opposite sides of a navigation:
//   • openObjectiveInChat(entry)      — from either detail host: arm the
//     handoff and navigate to a fresh chat, pre-bound to the objective's
//     Playbook and named after it (query params session.js already reads).
//   • startObjectiveChat(sessionId, payload) — consumed at session mount:
//     Archie opens on the diagnosis, then the question picker.
//
// The recommendation itself is resolved by nextMoveFor(): authored in
// mocks.objectiveNextMoves (deterministic, evidence-citing), with a generic
// derivation by objective state as the fallback — so an un-authored objective
// still gets a door, never a dead end.
//
// Version pins MUST match session.js's so the assistant / inline-question
// module instances are shared — each holds per-session state in a module-local
// Map, and a second copy at a different URL would hold its own.

import { navigate } from "./router.js?v=54";
import { setHandoff } from "./handoff.js?v=34";
import { postAssistantMessage, sendMessage } from "./assistant.js?v=119";
import * as inlineQuestion from "./inline-question.js?v=62";
import { objectiveNextMoves } from "./mocks.js?v=118";

export const OBJECTIVE_CHAT_HANDOFF = "pendingObjectiveChat";

// The measure the generic fallback talks about — the weakest one, by the same
// reading objectives-model uses (worst progress wins), duplicated in three
// lines rather than importing a screens/ module from a root flow.
function weakMeasureLabel(entry) {
  const measures = entry.resolved?.status === "parked" ? [entry.resolved.proxy] : entry.resolved?.measures || [];
  const weak = [...measures].sort((a, b) => (a.progressPct ?? 100) - (b.progressPct ?? 100))[0];
  return weak?.metricLabel || "the weak measure";
}

/** The recommendation an objective's detail ends on. Authored, or derived. */
export function nextMoveFor(entry) {
  const authored = objectiveNextMoves[entry.key];
  if (authored) return authored;
  const metric = weakMeasureLabel(entry);
  if (entry.collecting) {
    return {
      pitch: `This one is still collecting — let's publish what feeds ${metric.toLowerCase()}, so the verdict lands with data behind it.`,
      cta: "Brief me in a chat",
      opening: `"${entry.label}" is still in its collecting window — no verdict yet, which makes this the cheapest moment to act. Let's publish what feeds ${metric.toLowerCase()} so the first verdict lands with data behind it.`,
    };
  }
  if (entry.verdict?.tier === "strong") {
    return {
      pitch: `Everything is on track — let's look at what carries ${metric.toLowerCase()} and make more of it.`,
      cta: "Double down in a chat",
      opening: `"${entry.label}" is on track. The useful question now is WHAT carries it — let's name what's working on ${metric.toLowerCase()} and make more of exactly that.`,
    };
  }
  return {
    pitch: `${metric} is the measure deciding this verdict — let's draft the posts that move it.`,
    cta: "Fix this in a chat",
    opening: `We're here about "${entry.label}" — ${metric.toLowerCase()} is the measure deciding the verdict right now. Let's look at what you've published against it and draft what moves it.`,
  };
}

const DEFAULT_ANGLES = [
  { value: "What should we publish to move this measure?", label: "What should we publish?" },
  { value: "What in my recent posts worked against this objective?", label: "What worked so far?" },
  { value: "Draft two posts aimed at this objective.", label: "Draft 2 posts for it" },
];

/**
 * From a detail host (the List panel or the board's modal) — spawn a chat that
 * opens on this objective.
 * @param {object} entry — a boardEntries() entry (key, ctxId, label, …).
 */
export function openObjectiveInChat(entry) {
  if (!entry?.ctxId) return false;
  setHandoff(OBJECTIVE_CHAT_HANDOFF, { key: entry.key, ctxId: entry.ctxId, label: entry.label });
  // Playbook + chat name ride in the URL: session.js resolves `?contextId=` and
  // `?title=` when it mints a `new-*` session, so the chat is bound on its very
  // first paint instead of being renamed a frame later (topic-flow's rule).
  const params = new URLSearchParams();
  params.set("contextId", entry.ctxId);
  params.set("title", entry.label);
  navigate(`/session/new-${Date.now().toString(36)}?${params.toString()}`);
  return true;
}

/**
 * Consumed at session mount: Archie opens on the diagnosis, then offers the
 * angles as a question picker — prompt shortcuts, not a new action surface.
 */
export function startObjectiveChat(sessionId, payload) {
  const move = objectiveNextMoves[payload.key] || null;
  const opening =
    move?.opening ||
    `We're here about "${payload.label}". Let's look at what you've published against it and draft what moves it.`;
  postAssistantMessage(sessionId, opening);

  inlineQuestion.ask(sessionId, {
    title: "Where do we start?",
    stepLabel: "Objective",
    items: (move?.angles || DEFAULT_ANGLES).map((a) => ({
      value: a.value,
      label: a.label,
      icon: "ap-icon-target",
    })),
    customPlaceholder: "Ask me anything about this objective…",
    onPick: (text) => sendMessage(sessionId, text),
    onCustom: (text) => sendMessage(sessionId, text),
    onSkip: () => {},
  });
}
