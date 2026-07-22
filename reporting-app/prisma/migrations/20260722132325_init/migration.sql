-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "displayName" TEXT,
    "ingestionSecretHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "hermesSessionId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "displayName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "estimatedCostUsd" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_messages" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "run_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_clerkUserId_key" ON "customers"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_ingestionSecretHash_key" ON "customers"("ingestionSecretHash");

-- CreateIndex
CREATE INDEX "runs_customerId_startedAt_idx" ON "runs"("customerId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "runs_customerId_hermesSessionId_key" ON "runs"("customerId", "hermesSessionId");

-- CreateIndex
CREATE INDEX "run_messages_runId_timestamp_sortIndex_idx" ON "run_messages"("runId", "timestamp", "sortIndex");

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_messages" ADD CONSTRAINT "run_messages_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
