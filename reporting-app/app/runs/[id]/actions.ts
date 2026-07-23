"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCustomer } from "@/lib/customer";
import {
  setPlatformEditedContent,
  resetPlatformEditedContent,
  setPlatformPosted,
} from "@/lib/db";
import type { PlatformKey } from "@/lib/platform-content";

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
