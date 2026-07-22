-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'YAD2');

-- CreateEnum
CREATE TYPE "PostMode" AS ENUM ('MANUAL', 'AUTO_IMMEDIATE', 'AUTO_AFTER_EDIT');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "instagramPostMode" "PostMode" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "run_platform_content" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "editedContent" TEXT,
    "posted" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_platform_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "run_platform_content_runId_platform_key" ON "run_platform_content"("runId", "platform");

-- AddForeignKey
ALTER TABLE "run_platform_content" ADD CONSTRAINT "run_platform_content_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
