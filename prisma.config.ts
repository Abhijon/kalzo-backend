import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Prisma 7: CLI/migrations need Neon DIRECT (unpooled). App runtime uses DATABASE_URL (pooled).
  // `prisma generate` needs no database, so a missing URL must not block builds.
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
});
