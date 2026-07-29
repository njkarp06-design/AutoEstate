/**
 * Recognises Hermes's own background-review turns, which are not customer
 * activity and must never reach the dashboard.
 *
 * After a session's real activity Hermes spawns an internal housekeeping turn
 * asking the agent to consider saving to memory and/or update its skill
 * library. It runs on a FORK of the agent that shares the parent's session_id
 * with `_persist_disabled = True` (agent/background_review.py), so Hermes never
 * writes it to its own state.db - but it is still a real LLM call, and a real
 * LLM call is exactly what the sync plugins' pre_llm_call/post_llm_call hooks
 * fire on. So these turns reach us, and nothing upstream marks them internal.
 *
 * Left unfiltered they land as ordinary Run rows. They carry no platform
 * content, so deriveListingTitle falls back to the raw first line and the
 * Activity page shows an entry TITLED WITH HERMES'S OWN INTERNAL PROMPT whose
 * body is the agent's private notes about the customer ("...reinforced
 * existing patterns (telegraphic input, complete details upfront...)"). That is
 * the opposite of the legible-and-trustworthy-to-a-non-technical-viewer bar
 * Phase 4 is held to.
 *
 * Filtered at ingest rather than in the sync plugins, deliberately: plugins are
 * physical copies inside each Hermes profile, so a plugin fix reaches a running
 * agent only via a manual copy plus a gateway restart, on every profile, while
 * a route fix ships with the app. Ingest is also the single choke point both
 * plugins post through.
 */

/**
 * Hermes builds three of these - `_MEMORY_REVIEW_PROMPT`, `_SKILL_REVIEW_PROMPT`
 * and `_COMBINED_REVIEW_PROMPT` in agent/background_review.py - picked by which
 * triggers fired. This matches the stem all three SHARE rather than
 * enumerating them: Hermes's own denylist (`_REVIEW_HARNESS_PREFIXES` in
 * hermes_state.py) lists only the first two and would miss the combined
 * variant, and a fourth prompt would very likely open the same way.
 *
 * Anchored at the start of the message on purpose. The two failure directions
 * are not symmetric: a false negative publishes the agent's internal monologue
 * about the customer to that same customer, while a false positive drops one
 * turn from the dashboard - recoverable, since the transcript is still in the
 * profile's state.db and re-sending the message re-ingests it. An anchored
 * match on this exact phrase is not something an agent sending listing facts
 * types by accident.
 */
const REVIEW_HARNESS_STEM = /^\s*review the conversation above\b/i;

export function isBackgroundReviewTurn(
  userMessage: string | null | undefined,
): boolean {
  return !!userMessage && REVIEW_HARNESS_STEM.test(userMessage);
}
