-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'UNDER_CONTRACT', 'SOLD');

-- AlterTable
ALTER TABLE "runs" ADD COLUMN     "listingId" TEXT;

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "rooms" DOUBLE PRECISION NOT NULL,
    "sqm" DOUBLE PRECISION NOT NULL,
    "floor" INTEGER,
    "price" INTEGER,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_customerId_status_idx" ON "listings"("customerId", "status");

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
