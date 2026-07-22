import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Customer } from "@/prisma/generated/prisma/client";

/**
 * Resolves the logged-in Clerk user to their Customer row. Customers are
 * provisioned by the operator (email set ahead of time, before the customer
 * ever logs in - onboarding already requires a human to run Terraform and
 * pair WhatsApp per customer, so there's no self-serve signup story here).
 * On first login, the Clerk user gets linked to that pre-provisioned row by
 * verified email.
 */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.customer.findUnique({
    where: { clerkUserId: userId },
  });
  if (existing) return existing;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return null;

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) return null; // signed in, but not provisioned by the operator yet

  return prisma.customer.update({
    where: { id: customer.id },
    data: { clerkUserId: userId },
  });
}
