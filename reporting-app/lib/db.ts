import { prisma } from "@/lib/prisma";
import type { Customer } from "@/prisma/generated/prisma/client";
import type { PlatformKey } from "@/lib/platform-content";
import { groupRunsIntoListings } from "@/lib/run-grouping";

export type RunStatus = "completed" | "in_progress";

// DB-facing platform value, kept as an inline literal union rather than an
// import of Prisma's generated `Platform` type - same decoupling convention
// as toRunStatus below, which doesn't import the generated `RunStatus` type
// either even though one exists.
type DbPlatform = "INSTAGRAM" | "FACEBOOK" | "YAD2";

function toPlatformKey(platform: DbPlatform): PlatformKey {
  if (platform === "INSTAGRAM") return "instagram";
  if (platform === "FACEBOOK") return "facebook";
  return "yad2";
}

function toPlatformEnum(key: PlatformKey): DbPlatform {
  if (key === "instagram") return "INSTAGRAM";
  if (key === "facebook") return "FACEBOOK";
  return "YAD2";
}

export type RunPlatformStatus = {
  editedContent: string | null;
  posted: boolean;
  postedAt: number | null; // epoch seconds
};

const EMPTY_PLATFORM_STATUS: RunPlatformStatus = {
  editedContent: null,
  posted: false,
  postedAt: null,
};

export type Run = {
  id: string;
  source: string;
  startedAt: number; // epoch seconds - kept as a number so lib/format.ts needs no changes
  status: RunStatus;
  title: string | null;
};

export type RunMessage = {
  role: string;
  content: string;
  timestamp: number;
};

export type RunDetail = Run & {
  messages: RunMessage[];
  platformStatus: Record<PlatformKey, RunPlatformStatus>;
};

function toEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function toRunStatus(status: "IN_PROGRESS" | "COMPLETED"): RunStatus {
  return status === "COMPLETED" ? "completed" : "in_progress";
}

// Real turns complete in ~10-40s (observed). A run still IN_PROGRESS with no
// messages well past that is an orphaned "ghost" - Hermes's busy_input_mode:
// interrupt setting can merge a rapid follow-up message into the next turn,
// and the interrupted turn's own post_llm_call correctly never fires (Hermes
// won't sync a turn it considers interrupted). Filtering these out keeps the
// "In progress" badge trustworthy - self-correcting, since a run that later
// does get a message stops matching this filter immediately.
//
// Applied identically in getRuns and getRun's session-scoped query: a ghost
// left out of the list must also be left out of grouping when viewing a
// sibling run's detail page, or the two would disagree on a merged group's
// title/messages (a ghost run's own turn_started title can differ from -
// and predate - the listing that actually went on to complete).
const STALE_IN_PROGRESS_MS = 3 * 60 * 1000;

function excludeGhostRuns(customerId: string) {
  return {
    customerId,
    NOT: {
      status: "IN_PROGRESS" as const,
      messages: { none: {} },
      startedAt: { lt: new Date(Date.now() - STALE_IN_PROGRESS_MS) },
    },
  };
}

/**
 * Every listing for the given customer - one entry per grouped listing, not
 * per Hermes turn (see run-grouping.ts). A listing that needed the skill's
 * batched-follow-up-question flow spans multiple turns/Run rows but must
 * still show up as a single Activity entry.
 */
export async function getRuns(customer: Customer): Promise<Run[]> {
  const runs = await prisma.run.findMany({
    where: excludeGhostRuns(customer.id),
    // Ascending: grouping needs chronological order within each session.
    // Re-sorted for display after grouping, below.
    orderBy: { startedAt: "asc" },
    include: {
      messages: { orderBy: [{ timestamp: "asc" }, { sortIndex: "asc" }] },
    },
  });

  const groups = groupRunsIntoListings(runs);

  return groups
    .map((group) => {
      const first = group.runs[0];
      const last = group.runs[group.runs.length - 1];
      return {
        // The last (closing, or latest-while-still-open) run's id is what
        // links point at - it holds the real content, once there is any.
        id: last.id,
        source: last.source,
        // The first run's startedAt - when the listing request actually
        // began. Title prefers the group's clean, generated-content-derived
        // title (see run-grouping.ts); falls back to the first run's raw,
        // agent-message-derived title while still waiting on a reply.
        startedAt: toEpochSeconds(first.startedAt),
        status: toRunStatus(last.status),
        title: group.listingTitle ?? first.title,
      };
    })
    .sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * A single listing's full transcript for the given customer - null if not
 * found or not owned by them. `id` may be any run in the listing's group
 * (the canonical last-run id from the Activity list, or an older precursor
 * id); either way this returns the whole group merged, per run-grouping.ts.
 */
export async function getRun(id: string, customer: Customer): Promise<RunDetail | null> {
  const target = await prisma.run.findFirst({
    where: { id, customerId: customer.id },
    select: { hermesSessionId: true },
  });
  if (!target) return null;

  const sessionRuns = await prisma.run.findMany({
    where: { ...excludeGhostRuns(customer.id), hermesSessionId: target.hermesSessionId },
    orderBy: { startedAt: "asc" },
    include: {
      messages: { orderBy: [{ timestamp: "asc" }, { sortIndex: "asc" }] },
      platformContent: true,
    },
  });

  const group = groupRunsIntoListings(sessionRuns).find((g) =>
    g.runs.some((r) => r.id === id),
  );
  if (!group) return null;

  const first = group.runs[0];
  const last = group.runs[group.runs.length - 1];

  const platformStatus: Record<PlatformKey, RunPlatformStatus> = {
    instagram: EMPTY_PLATFORM_STATUS,
    facebook: EMPTY_PLATFORM_STATUS,
    yad2: EMPTY_PLATFORM_STATUS,
  };
  for (const row of last.platformContent) {
    platformStatus[toPlatformKey(row.platform)] = {
      editedContent: row.editedContent,
      posted: row.posted,
      postedAt: row.postedAt ? toEpochSeconds(row.postedAt) : null,
    };
  }

  return {
    id: last.id,
    source: last.source,
    startedAt: toEpochSeconds(first.startedAt),
    status: toRunStatus(last.status),
    title: group.listingTitle ?? first.title,
    messages: group.runs.flatMap((r) =>
      r.messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: toEpochSeconds(m.timestamp),
      })),
    ),
    platformStatus,
  };
}

/**
 * Ownership-checked mutation helpers for per-run, per-platform state Hermes
 * doesn't know about. Each re-derives the owning run from (runId, customer)
 * and no-ops if the run isn't found or isn't owned by this customer - same
 * pattern as getRun, and the shape the Next.js docs recommend for a Data
 * Access Layer backing Server Actions (take the change + an id, re-check
 * ownership server-side, never trust a client-supplied ownership claim).
 */

async function findOwnedRun(runId: string, customer: Customer) {
  return prisma.run.findFirst({ where: { id: runId, customerId: customer.id } });
}

export async function setPlatformEditedContent(
  runId: string,
  customer: Customer,
  platform: PlatformKey,
  content: string,
): Promise<void> {
  const run = await findOwnedRun(runId, customer);
  if (!run) return;

  await prisma.runPlatformContent.upsert({
    where: { runId_platform: { runId, platform: toPlatformEnum(platform) } },
    create: { runId, platform: toPlatformEnum(platform), editedContent: content },
    update: { editedContent: content },
  });
}

/** Clears an edit override back to Hermes's original text. Does not touch posted/postedAt - editing and posting are independent. */
export async function resetPlatformEditedContent(
  runId: string,
  customer: Customer,
  platform: PlatformKey,
): Promise<void> {
  const run = await findOwnedRun(runId, customer);
  if (!run) return;

  await prisma.runPlatformContent.upsert({
    where: { runId_platform: { runId, platform: toPlatformEnum(platform) } },
    create: { runId, platform: toPlatformEnum(platform), editedContent: null },
    update: { editedContent: null },
  });
}

export async function setPlatformPosted(
  runId: string,
  customer: Customer,
  platform: PlatformKey,
  posted: boolean,
): Promise<void> {
  const run = await findOwnedRun(runId, customer);
  if (!run) return;

  await prisma.runPlatformContent.upsert({
    where: { runId_platform: { runId, platform: toPlatformEnum(platform) } },
    create: { runId, platform: toPlatformEnum(platform), posted, postedAt: posted ? new Date() : null },
    update: { posted, postedAt: posted ? new Date() : null },
  });
}
