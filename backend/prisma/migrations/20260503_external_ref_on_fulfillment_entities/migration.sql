-- Add explicit externalSource + externalRef columns to License, Delivery,
-- and Shipment so the partner-system back-reference is inspectable.
-- Storlaunch populates ('storlaunch', <checkoutSessionId>); direct fulkruma
-- tenants leave both null.

ALTER TABLE "License"
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalRef" TEXT;

ALTER TABLE "Delivery"
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalRef" TEXT;

ALTER TABLE "Shipment"
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalRef" TEXT;

CREATE INDEX "License_accountId_externalSource_externalRef_idx"
  ON "License" ("accountId", "externalSource", "externalRef");
CREATE INDEX "Delivery_accountId_externalSource_externalRef_idx"
  ON "Delivery" ("accountId", "externalSource", "externalRef");
CREATE INDEX "Shipment_accountId_externalSource_externalRef_idx"
  ON "Shipment" ("accountId", "externalSource", "externalRef");

-- Backfill existing storlaunch-sourced rows. Delivery + Shipment carry
-- a checkoutSessionId — use it as the externalRef. License has no
-- session column, so backfill by joining through any Delivery sharing
-- the same (accountId, productId, customerId, createdAt minute).
UPDATE "Delivery"
  SET "externalSource" = 'storlaunch', "externalRef" = "checkoutSessionId"
  WHERE "checkoutSessionId" IS NOT NULL AND "externalSource" IS NULL;

UPDATE "Shipment"
  SET "externalSource" = 'storlaunch', "externalRef" = "checkoutSessionId"
  WHERE "checkoutSessionId" IS NOT NULL AND "externalSource" IS NULL;

-- License backfill: pair each license with the closest delivery on
-- (accountId, customerId, productId) by createdAt. Best-effort; misses
-- are fine — externalRef is informational.
UPDATE "License" l
  SET "externalSource" = 'storlaunch',
      "externalRef" = d."checkoutSessionId"
  FROM "Delivery" d
  WHERE l."externalSource" IS NULL
    AND d."accountId" = l."accountId"
    AND d."customerId" = l."customerId"
    AND d."productId" = l."productId"
    AND d."createdAt" BETWEEN l."createdAt" - interval '1 minute' AND l."createdAt" + interval '1 minute';
