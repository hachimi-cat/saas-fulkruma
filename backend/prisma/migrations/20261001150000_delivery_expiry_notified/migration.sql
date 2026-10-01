-- fulkruma.delivery.expired.v1: when the expiry of a delivery was told (null = not yet).
ALTER TABLE "Delivery" ADD COLUMN "expiryNotifiedAt" TIMESTAMP(3);

-- Deliveries that expired before this release are not announced now.
UPDATE "Delivery" SET "expiryNotifiedAt" = "expiresAt" WHERE "expiresAt" <= CURRENT_TIMESTAMP;

CREATE INDEX "Delivery_expiryNotifiedAt_expiresAt_idx" ON "Delivery"("expiryNotifiedAt", "expiresAt");
