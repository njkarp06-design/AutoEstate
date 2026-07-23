import { splitPlatformContent, deriveListingTitle } from "@/lib/platform-content";

// A minimal structural shape, not an import of Prisma's generated Run/
// RunMessage types - same decoupling convention as lib/db.ts's DbPlatform.
export type GroupableMessage = {
  role: string;
  content: string;
  timestamp: Date;
  sortIndex: number;
};

export type GroupableRun<M extends GroupableMessage = GroupableMessage> = {
  id: string;
  hermesSessionId: string;
  startedAt: Date;
  status: "IN_PROGRESS" | "COMPLETED";
  title: string | null;
  source: string;
  displayName: string | null;
  messages: M[];
};

export type RunGroup<T extends GroupableRun = GroupableRun> = {
  // Chronological order within the group - group.runs[0] is the listing's
  // first turn, group.runs.at(-1) is the turn that either produced the real
  // generated content or is the latest turn while still waiting on a reply.
  runs: T[];
  // A clean one-line title derived from the closing run's generated Yad2
  // content (see deriveListingTitle) - null if the group hasn't produced
  // real content yet (still waiting on a reply) or the content didn't
  // split as expected, in which case callers should fall back to the first
  // run's own raw-derived title.
  listingTitle: string | null;
};

function latestAssistantMessage<M extends GroupableMessage>(run: GroupableRun<M>): M | undefined {
  return [...run.messages]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.sortIndex - b.sortIndex)
    .findLast((m) => m.role === "assistant");
}

function matchedContent(run: GroupableRun) {
  const assistantMessage = latestAssistantMessage(run);
  if (!assistantMessage) return null;
  const parsed = splitPlatformContent(assistantMessage.content);
  return parsed.matched ? parsed : null;
}

/**
 * Groups per-turn Runs into per-listing clusters for display.
 *
 * `/api/ingest` deliberately creates one Run per Hermes conversational turn
 * (see prisma/schema.prisma's hermesTurnId comment) so that unrelated
 * listings sent back-to-back in the same long-lived WhatsApp/Telegram
 * session never merge together. But a single listing that needs the skill's
 * one-batched-follow-up-question flow (see listing-to-social's SKILL.md)
 * legitimately spans two or more turns - without this grouping, that shows
 * up as multiple separate "listings" on the dashboard, one of which is
 * often just a raw photo description with no real content.
 *
 * Within a session, chain consecutive runs into one group as long as each
 * run's own final assistant message doesn't parse as real generated content
 * (splitPlatformContent's matched:false - a clarifying question, not a
 * listing). The run that DOES produce matched content closes the group; any
 * run after that, even in the same session, starts a fresh group. A group
 * that never gets a matching run stays open (the agent is still waiting on
 * a reply) and is returned as-is, not hidden.
 *
 * Input must already be sorted ascending by startedAt across the whole set
 * - grouping only depends on order *within* a session, which a global
 * ascending sort preserves as a subsequence. Different callers fetch runs
 * differently (all of a customer's runs vs. all runs in one session), so
 * sorting is the caller's responsibility rather than baked in here.
 */
export function groupRunsIntoListings<T extends GroupableRun>(runs: T[]): RunGroup<T>[] {
  const groups: RunGroup<T>[] = [];
  const openGroupBySession = new Map<string, RunGroup<T>>();

  for (const run of runs) {
    let group = openGroupBySession.get(run.hermesSessionId);
    if (!group) {
      group = { runs: [], listingTitle: null };
      groups.push(group);
      openGroupBySession.set(run.hermesSessionId, group);
    }
    group.runs.push(run);

    const parsed = matchedContent(run);
    if (parsed) {
      group.listingTitle = deriveListingTitle(parsed.sections.yad2);
      openGroupBySession.delete(run.hermesSessionId);
    }
  }

  return groups;
}
