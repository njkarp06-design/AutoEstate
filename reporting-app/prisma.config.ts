import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Anchored to THIS FILE, never process.cwd() - the same defect class each of
// the scripts/ files documents avoiding, and this is the file that governs the
// production `migrate deploy`. A bare ".env.local" resolved against whatever
// directory the prisma CLI happened to be invoked from, and the failure reads
// as an unrelated connection error ("SASL: client password must be a string").
// __dirname when the config loader transpiles to CJS; import.meta.url in ESM.
const configDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
dotenv.config({ path: path.join(configDir, ".env.local") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
