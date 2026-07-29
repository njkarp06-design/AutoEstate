import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { normalizeWhatsappNumber } from "@/lib/ref-code";
import type { Customer } from "@/prisma/generated/prisma/client";

/**
 * Resolves the logged-in Clerk user to their Customer row. Customers are
 * provisioned by the operator (email set ahead of time, before the customer
 * ever logs in - onboarding already requires a human to run Terraform and
 * pair WhatsApp per customer, so there's no self-serve signup story here).
 * On first login, the Clerk user gets linked to that pre-provisioned row by
 * verified email.
 *
 * "Verified" is now ENFORCED here rather than only claimed. Email is the entire
 * tenancy boundary on first login: whoever presents a matching address gets
 * permanently bound to that Customer row (`clerkUserId` is unique, so the FIRST
 * claimant wins) and with it the customer's runs, listings and buyer leads. This
 * function previously read the address and bound the row without ever looking at
 * `verification.status`, which left that boundary resting entirely on a Clerk
 * dashboard setting that nothing in this repo pins, asserts or documents - and
 * the operator's emails are not secrets, they go in terraform.tfvars.
 *
 * Anything other than `verified` fails closed: the caller gets null and the
 * pages render their existing "your account isn't linked yet" state, which is
 * the honest message - they genuinely are not linked.
 *
 * The check gates the LINK, not every request: an already-linked user returns
 * from the clerkUserId lookup above without reaching it. That is deliberate, not
 * an oversight - the binding is what needs a verified address, and re-checking
 * per request would lock a real customer out if they later changed their primary
 * email to one pending verification.
 */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.customer.findUnique({
    where: { clerkUserId: userId },
  });
  if (existing) return existing;

  const user = await currentUser();
  const primaryEmail = user?.primaryEmailAddress;
  const email = primaryEmail?.emailAddress;
  if (!email) return null;

  // Checked BEFORE the lookup, so an unverified address never even probes which
  // emails are provisioned.
  if (primaryEmail?.verification?.status !== "verified") {
    console.warn(
      "customer: refusing to link Clerk user %s - primary email is not verified (status: %s)",
      userId,
      primaryEmail?.verification?.status ?? "none",
    );
    return null;
  }

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) return null; // signed in, but not provisioned by the operator yet

  return prisma.customer.update({
    where: { id: customer.id },
    data: { clerkUserId: userId },
  });
}

// Inline literal union rather than Prisma's generated `PostMode` - see
// lib/db.ts's DbPlatform for the convention. Worth noting the one asymmetry:
// Customer itself IS passed around as Prisma's raw generated type throughout
// this app (unlike Run/RunMessage, which get translated), so this field
// follows that existing precedent rather than inventing a one-off exception.
export type InstagramPostMode = "MANUAL" | "AUTO_IMMEDIATE" | "AUTO_AFTER_EDIT";

export async function updateInstagramPostMode(
  customer: Customer,
  mode: InstagramPostMode,
): Promise<void> {
  await prisma.customer.update({
    where: { id: customer.id },
    data: { instagramPostMode: mode },
  });
}

/**
 * Sets (or clears, when passed an empty string) the Telegram chat where this
 * customer's buyer-lead alerts are pushed. A blank value stores null - no
 * push, dashboard-only. See lib/notify-operator.ts.
 */
export async function updateOperatorTelegramChatId(
  customer: Customer,
  chatId: string,
): Promise<void> {
  const trimmed = chatId.trim();
  await prisma.customer.update({
    where: { id: customer.id },
    data: { operatorTelegramChatId: trimmed === "" ? null : trimmed },
  });
}

/**
 * The buyer-facing WhatsApp number used to build listing ad links. Stored
 * normalized to digits so the stored value is exactly what wa.me needs and
 * link-building never has to re-parse a formatting variant; the action layer
 * rejects anything that can't normalize, so this is only reached with a value
 * that already passed.
 */
export async function updateBuyerWhatsappNumber(
  customer: Customer,
  rawNumber: string,
): Promise<void> {
  const trimmed = rawNumber.trim();
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      buyerWhatsappNumber: trimmed === "" ? null : normalizeWhatsappNumber(trimmed),
    },
  });
}
