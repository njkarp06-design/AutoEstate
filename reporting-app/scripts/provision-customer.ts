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
import { PrismaClient } from "../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

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

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const customer = await prisma.customer.upsert({
    where: { email },
    create: { email, ingestionSecretHash: secretHash },
    update: { ingestionSecretHash: secretHash },
  });

  console.log(`Customer provisioned: ${customer.id} (${customer.email})`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
