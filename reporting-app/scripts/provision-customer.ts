// Registers a customer's machine credential in the reporting webapp's
// database: creates or updates their Customer row with the SHA-256 hash of a
// secret (the secret itself is never stored).
//
// There are TWO credentials per customer, scoped by role - see
// lib/ingest-auth.ts and the Customer model comment for why:
//
//   operator (default) - POST /api/ingest, GET /api/listings/active
//   buyer              - POST /api/inquiries, GET /api/listings/buyer-view
//
// Operator, right after `terraform apply` for a new customer instance:
//
//   cd infra/customers/<customer>
//   terraform output -raw operator_ingestion_secret | npx tsx ../../../reporting-app/scripts/provision-customer.ts customer@email.com
//
// Buyer, once that customer has a buyer instance. Mint a secret, register it,
// and put the same value in the buyer profile's AUTOESTATE_INGESTION_SECRET:
//
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//   echo <that-secret> | npx tsx scripts/provision-customer.ts customer@email.com --role buyer
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

const USAGE =
  "Usage: <secret> | npx tsx scripts/provision-customer.ts <email> [--role operator|buyer]";

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"));

  const roleIndex = args.indexOf("--role");
  const role = roleIndex === -1 ? "operator" : args[roleIndex + 1];
  if (role !== "operator" && role !== "buyer") {
    console.error(`Unknown role ${JSON.stringify(role)}. Expected "operator" or "buyer".`);
    console.error(USAGE);
    process.exit(1);
  }

  if (!email) {
    console.error(USAGE);
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
    const existing = await prisma.customer.findUnique({ where: { email } });

    // A buyer credential is an ADDITION to an existing customer, never the
    // thing that creates one: Customer.operatorSecretHash is non-null, so a
    // buyer-first create would have to invent one. Fail loudly rather than
    // half-provision a customer whose operator instance can never authenticate.
    if (role === "buyer" && !existing) {
      console.error(
        `No customer found for ${email}. Provision the operator credential first ` +
          `(omit --role), then add the buyer one.`,
      );
      process.exit(1);
    }

    // Reject a secret already registered as this customer's OTHER role.
    // Registering one value for both roles would look like a correct
    // two-credential setup while silently rebuilding the single shared
    // credential the split exists to eliminate.
    if (existing) {
      const otherHash =
        role === "operator" ? existing.buyerSecretHash : existing.operatorSecretHash;
      if (otherHash === secretHash) {
        console.error(
          `That secret is already registered as this customer's ` +
            `${role === "operator" ? "buyer" : "operator"} credential. The two roles must ` +
            `use different secrets - sharing one defeats the split entirely.`,
        );
        process.exit(1);
      }
    }

    const customer = await prisma.customer.upsert({
      where: { email },
      create: { email, operatorSecretHash: secretHash },
      update:
        role === "operator"
          ? { operatorSecretHash: secretHash }
          : { buyerSecretHash: secretHash },
    });

    console.log(
      `Customer provisioned: ${customer.id} (${customer.email}) — ${role} credential set`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
