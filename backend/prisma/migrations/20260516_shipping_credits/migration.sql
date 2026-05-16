-- S-046: per-merchant prepaid shipping credit + audit-trail ledger.
-- Biteship has no multi-tenant billing; we run one Forjio-side Saldo
-- and bookkeep per-merchant credit here. Topped up via Plugipay
-- (Midtrans), debited on confirmPickup, refunded on cancel.

CREATE TABLE "ShippingCredit" (
    "accountId" TEXT NOT NULL,
    "balance"   INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingCredit_pkey" PRIMARY KEY ("accountId")
);

CREATE TYPE "ShippingCreditTransactionKind"
  AS ENUM ('topup', 'shipment_charge', 'shipment_refund', 'manual_adjustment');

CREATE TABLE "ShippingCreditTransaction" (
    "id"           TEXT NOT NULL,
    "accountId"    TEXT NOT NULL,
    "kind"         "ShippingCreditTransactionKind" NOT NULL,
    "amount"       INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "shipmentId"   TEXT,
    "externalRef"  TEXT,
    "memo"         TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingCreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShippingCreditTransaction_accountId_createdAt_idx"
  ON "ShippingCreditTransaction" ("accountId", "createdAt" DESC);

CREATE INDEX "ShippingCreditTransaction_shipmentId_idx"
  ON "ShippingCreditTransaction" ("shipmentId");

ALTER TABLE "ShippingCreditTransaction"
  ADD CONSTRAINT "ShippingCreditTransaction_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ShippingCredit"("accountId")
  ON DELETE CASCADE ON UPDATE CASCADE;
