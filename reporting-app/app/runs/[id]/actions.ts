"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCustomer } from "@/lib/customer";
import {
  setPlatformEditedContent,
  resetPlatformEditedContent,
  setPlatformPosted,
} from "@/lib/db";
import type { PlatformKey } from "@/lib/platform-content";

// These actions no-op silently when there's no customer, or when lib/db.ts's
// helpers find the run isn't owned by them. That is deliberate and stays:
// these are ownership checks on an endpoint reachable by anyone who can send
// the POST (see Next's Server Actions security notes), and telling a caller
// whether a run id exists but belongs to someone else is exactly the
// distinction not worth leaking. A legitimate user cannot reach either branch
// - the page already resolved their customer and their own run to render the
// form. Contrast settings/actions.ts, where a *validation* rejection is
// something the real user needs to see.

// runId is the group's canonical run (content rows live there); viewedRunId is
// the URL the customer is actually on, which may be an older precursor run of
// the same group (see lib/db.ts's getRun). Revalidating only the canonical
// path left the viewed precursor-URL page stale after a save - "Mark posted"
// appeared to do nothing until a hard reload.
function revalidateRunPaths(runId: string, viewedRunId: string) {
  revalidatePath(`/runs/${runId}`);
  if (viewedRunId !== runId) revalidatePath(`/runs/${viewedRunId}`);
}

export async function savePlatformContentAction(
  runId: string,
  viewedRunId: string,
  platform: PlatformKey,
  formData: FormData,
) {
  const customer = await getCurrentCustomer();
  if (!customer) return;

  const content = String(formData.get("content") ?? "").trim();
  if (!content) return; // empty edits are rejected, not saved as blank overrides

  await setPlatformEditedContent(runId, customer, platform, content);
  revalidateRunPaths(runId, viewedRunId);
}

export async function resetPlatformContentAction(
  runId: string,
  viewedRunId: string,
  platform: PlatformKey,
) {
  const customer = await getCurrentCustomer();
  if (!customer) return;

  await resetPlatformEditedContent(runId, customer, platform);
  revalidateRunPaths(runId, viewedRunId);
}

export async function setPlatformPostedAction(
  runId: string,
  viewedRunId: string,
  platform: PlatformKey,
  posted: boolean,
) {
  const customer = await getCurrentCustomer();
  if (!customer) return;

  await setPlatformPosted(runId, customer, platform, posted);
  revalidateRunPaths(runId, viewedRunId);
}
