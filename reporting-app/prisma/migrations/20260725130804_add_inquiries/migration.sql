-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEEDS_OPERATOR', 'HANDLED');

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "hermesSessionId" TEXT NOT NULL,
    "buyerContact" TEXT,
    "listingId" TEXT,
    "source" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEEDS_OPERATOR',
    "title" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_messages" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "hermesTurnId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inquiry_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiries_customerId_startedAt_idx" ON "inquiries"("customerId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inquiries_customerId_hermesSessionId_key" ON "inquiries"("customerId", "hermesSessionId");

-- CreateIndex
CREATE INDEX "inquiry_messages_inquiryId_timestamp_sortIndex_idx" ON "inquiry_messages"("inquiryId", "timestamp", "sortIndex");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_messages_inquiryId_hermesTurnId_role_key" ON "inquiry_messages"("inquiryId", "hermesTurnId", "role");

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
