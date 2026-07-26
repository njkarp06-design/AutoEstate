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

export async function savePlatformContentAction(
  runId: string,
  platform: PlatformKey,
  formData: FormData,
) {
  const customer = await getCurrentCustomer();
  if (!customer) return;

  const content = String(formData.get("content") ?? "").trim();
  if (!content) return; // empty edits are rejected, not saved as blank overrides

  await setPlatformEditedContent(runId, customer, platform, content);
  revalidatePath(`/runs/${runId}`);
}

export async function resetPlatformContentAction(runId: string, platform: PlatformKey) {
  const customer = await getCurrentCustomer();
  if (!customer) return;

  await resetPlatformEditedContent(runId, customer, platform);
  revalidatePath(`/runs/${runId}`);
}

export async function setPlatformPostedAction(
  runId: string,
  platform: PlatformKey,
  posted: boolean,
) {
  const customer = await getCurrentCustomer();
  if (!customer) return;

  await setPlatformPosted(runId, customer, platform, posted);
  revalidatePath(`/runs/${runId}`);
}
