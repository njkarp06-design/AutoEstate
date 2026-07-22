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

/** Every run for the logged-in customer. Empty if not signed in or not yet provisioned. */
export async function getRuns(): Promise<Run[]> {
  const customer = await getCurrentCustomer();
  if (!customer) return [];

  const runs = await prisma.run.findMany({
    where: { customerId: customer.id },
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
