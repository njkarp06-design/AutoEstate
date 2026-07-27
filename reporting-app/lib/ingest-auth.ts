import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { Customer } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Which instance is calling. Every machine-facing route belongs to exactly one
 * role, and a role's secret is valid ONLY on that role's routes:
 *
 *   operator -> POST /api/ingest, GET /api/listings/active
 *   buyer    -> POST /api/inquiries, GET /api/listings/buyer-view
 */
export type MachineRole = "operator" | "buyer";

export type MachineAuthResult =
  | { ok: true; customer: Customer }
  | { ok: false; status: number; error: string };

/**
 * Server-to-server auth for the routes a customer's Hermes instances call: a
 * per-customer bearer secret, not a Clerk session (an external instance has no
 * logged-in user). The hash lookup both authenticates the request and resolves
 * the customer to scope by, in one step.
 *
 * `role` IS THE POINT OF THIS FUNCTION, and it is required rather than
 * defaulted on purpose. The lookup is scoped to that role's column, so a
 * secret simply does not exist as far as the other role's routes are
 * concerned. Two consequences worth being explicit about:
 *
 *   1. There is deliberately NO fallback that tries the other column. Adding
 *      one "for compatibility" would silently restore the shared-credential
 *      problem this whole split exists to remove.
 *   2. A new machine-facing route cannot forget to authorize itself. Omitting
 *      the argument is a TypeScript error, not a security hole that looks like
 *      working code - which is what a "return the role and let each route
 *      compare it" design would have been.
 *
 * Why it matters: the buyer instance is the only surface untrusted people can
 * reach, and it used to hold the same secret that authenticates POST
 * /api/ingest - i.e. the ability to create and mutate Listing rows on the
 * customer's real data, including flipping a property to SOLD. That is
 * credential scope, and the buyer instance's tool lockdown does nothing about
 * it.
 */
export async function authenticateMachineRequest(
  request: NextRequest,
  role: MachineRole,
): Promise<MachineAuthResult> {
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!secret) {
    return { ok: false, status: 401, error: "missing bearer token" };
  }

  const secretHash = createHash("sha256").update(secret).digest("hex");

  // Scoped by role. A customer with no buyer instance yet has a NULL
  // buyerSecretHash, and no real hash can match NULL - so "not provisioned"
  // fails closed, exactly like "wrong secret".
  const customer =
    role === "operator"
      ? await prisma.customer.findUnique({ where: { operatorSecretHash: secretHash } })
      : await prisma.customer.findUnique({ where: { buyerSecretHash: secretHash } });

  if (!customer) {
    // Same message either way: a caller must not be able to tell "this secret
    // is real but wrong-role" from "this secret is nonsense".
    return { ok: false, status: 401, error: "invalid credentials" };
  }

  return { ok: true, customer };
}
