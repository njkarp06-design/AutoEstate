// Registers a new customer in the reporting webapp's database: creates or
// updates their Customer row with the given email and the SHA-256 hash of
// their Terraform-generated ingestion secret (the secret itself is never
// stored). Run once, right after `terraform apply` for a new customer
// instance:
//
//   cd infra/customers/<customer>
//   terraform output -raw ingestion_secret | npx tsx ../../../reporting-app/scripts/provision-customer.ts customer@email.com
//
// The email must match what Clerk shows for the customer's account (their
// login email) - that's how their first login gets linked to this row.
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

// Resolved against THIS FILE, never process.cwd(). The documented invocation
// above (and in infra/modules/hermes-instance/README.md) runs this from
// infra/customers/<slug>/, where a bare ".env.local" resolves to a path that
// does not exist - so DATABASE_URL came back undefined and provisioning failed
// at the exact moment a real customer was being onboarded, with only a Prisma
// connection error to explain it.
//
// process.argv[1] rather than import.meta.url: this runs under tsx with no
// "type": "module" in package.json, so ESM is not guaranteed and import.meta
// would be a syntax error under CJS.
const scriptDir = path.dirname(path.resolve(process.argv[1]));
dotenv.config({ path: path.resolve(scriptDir, "..", ".env.local") });

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.trim()));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error(
      "Usage: terraform output -raw ingestion_secret | npx tsx scripts/provision-customer.ts <email>",
    );
    process.exit(1);
  }

  const secret = await readStdin();
  if (!secret) {
    console.error("No secret piped in via stdin.");
    process.exit(1);
  }

  const secretHash = createHash("sha256").update(secret).digest("hex");

  // Named explicitly rather than left to surface as an opaque Prisma
  // connection error - this runs from another directory, so "which .env.local
  // did it read?" is the first question when it fails.
  if (!process.env.DATABASE_URL) {
    console.error(
      `DATABASE_URL is not set. Expected it in ${path.resolve(scriptDir, "..", ".env.local")}`,
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  // finally, not a trailing call: the client is local to main(), so the
  // catch handler below cannot reach it. Without this, a failed upsert left
  // the connection open until process exit.
  try {
    const customer = await prisma.customer.upsert({
      where: { email },
      create: { email, ingestionSecretHash: secretHash },
      update: { ingestionSecretHash: secretHash },
    });

    console.log(`Customer provisioned: ${customer.id} (${customer.email})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
