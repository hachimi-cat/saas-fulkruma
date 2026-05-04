-- CreateEnum
CREATE TYPE "FulkrumaPlan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'SCALE');

-- CreateEnum
CREATE TYPE "FulkrumaSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELING', 'CANCELED', 'PAST_DUE', 'INCOMPLETE');

-- CreateTable
CREATE TABLE "Subscription" (
    "accountId" TEXT NOT NULL,
    "plan" "FulkrumaPlan" NOT NULL DEFAULT 'FREE',
    "status" "FulkrumaSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAt" TIMESTAMP(3),
    "plugipayCustomerId" TEXT,
    "plugipaySubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "plugipayInvoiceId" TEXT NOT NULL,
    "plan" "FulkrumaPlan" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyUsage" (
    "accountId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "ordersFulfilled" INTEGER NOT NULL DEFAULT 0,
    "shipmentsCreated" INTEGER NOT NULL DEFAULT 0,
    "licensesIssued" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyUsage_pkey" PRIMARY KEY ("accountId","year","month")
);

-- CreateIndex
CREATE INDEX "Subscription_plugipayCustomerId_idx" ON "Subscription"("plugipayCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_plugipaySubscriptionId_idx" ON "Subscription"("plugipaySubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_plugipayInvoiceId_key" ON "Invoice"("plugipayInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_accountId_createdAt_idx" ON "Invoice"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "MonthlyUsage_accountId_idx" ON "MonthlyUsage"("accountId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Subscription"("accountId") ON DELETE CASCADE ON UPDATE CASCADE;
