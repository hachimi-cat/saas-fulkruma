-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "partner" TEXT;

-- CreateTable
CREATE TABLE "PartnerWorkspace" (
    "accountId" TEXT NOT NULL,
    "partner" TEXT NOT NULL,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "brandName" TEXT,
    "businessEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerWorkspace_pkey" PRIMARY KEY ("accountId")
);

-- CreateIndex
CREATE INDEX "PartnerWorkspace_partner_idx" ON "PartnerWorkspace"("partner");

-- CreateIndex
CREATE INDEX "ApiKey_partner_idx" ON "ApiKey"("partner");
