// One-off dev script: creates a test customer with a known ingestion secret,
// so the /api/ingest route can be exercised with curl before Clerk/Terraform exist.
// Not part of the app - delete once Phase A is verified.
import { createHash } from "node:crypto";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const secret = "dev-secret-12345";
  const secretHash = createHash("sha256").update(secret).digest("hex");

  const customer = await prisma.customer.upsert({
    where: { email: "dev-test@example.com" },
    create: {
      email: "dev-test@example.com",
      displayName: "Dev Test Customer",
      ingestionSecretHash: secretHash,
    },
    update: { ingestionSecretHash: secretHash },
  });

  console.log("Customer:", customer.id);
  console.log("Use this bearer secret for curl testing:", secret);
  await prisma.$disconnect();
}

main();
