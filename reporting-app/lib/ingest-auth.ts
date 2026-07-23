import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { Customer } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type IngestAuthResult =
  | { ok: true; customer: Customer }
  | { ok: false; status: number; error: string };

/**
 * Server-to-server auth shared by /api/ingest and /api/listings/active: a
 * per-customer bearer-token secret, not a Clerk session (external Hermes
 * instances have no logged-in user). The hash lookup below both
 * authenticates the request and resolves the customer to scope by in one
 * step - there's no separate "verify then look up" pass.
 */
export async function authenticateIngestRequest(
  request: NextRequest,
): Promise<IngestAuthResult> {
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!secret) {
    return { ok: false, status: 401, error: "missing bearer token" };
  }

  const secretHash = createHash("sha256").update(secret).digest("hex");
  const customer = await prisma.customer.findUnique({
    where: { ingestionSecretHash: secretHash },
  });
  if (!customer) {
    return { ok: false, status: 401, error: "invalid credentials" };
  }

  return { ok: true, customer };
}
