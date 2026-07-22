import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer";

export type RunStatus = "completed" | "in_progress";

export type Run = {
  id: string;
  source: string;
  displayName: string | null;
  startedAt: number; // epoch seconds - kept as a number so lib/format.ts needs no changes
  status: RunStatus;
  title: string | null;
  estimatedCostUsd: number | null;
};

export type RunMessage = {
  role: string;
  content: string;
  timestamp: number;
};

export type RunDetail = Run & {
  messages: RunMessage[];
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
const STALE_IN_PROGRESS_MS = 3 * 60 * 1000;

/** Every run for the logged-in customer. Empty if not signed in or not yet provisioned. */
export async function getRuns(): Promise<Run[]> {
  const customer = await getCurrentCustomer();
  if (!customer) return [];

  const runs = await prisma.run.findMany({
    where: {
      customerId: customer.id,
      NOT: {
        status: "IN_PROGRESS",
        messages: { none: {} },
        startedAt: { lt: new Date(Date.now() - STALE_IN_PROGRESS_MS) },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  return runs.map((run) => ({
    id: run.id,
    source: run.source,
    displayName: run.displayName,
    startedAt: toEpochSeconds(run.startedAt),
    status: toRunStatus(run.status),
    title: run.title,
    estimatedCostUsd: run.estimatedCostUsd ? Number(run.estimatedCostUsd) : null,
  }));
}

/** A single run's full transcript - null if not found or not owned by the logged-in customer. */
export async function getRun(id: string): Promise<RunDetail | null> {
  const customer = await getCurrentCustomer();
  if (!customer) return null;

  const run = await prisma.run.findFirst({
    where: { id, customerId: customer.id },
    include: { messages: { orderBy: [{ timestamp: "asc" }, { sortIndex: "asc" }] } },
  });
  if (!run) return null;

  return {
    id: run.id,
    source: run.source,
    displayName: run.displayName,
    startedAt: toEpochSeconds(run.startedAt),
    status: toRunStatus(run.status),
    title: run.title,
    estimatedCostUsd: run.estimatedCostUsd ? Number(run.estimatedCostUsd) : null,
    messages: run.messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: toEpochSeconds(m.timestamp),
    })),
  };
}
