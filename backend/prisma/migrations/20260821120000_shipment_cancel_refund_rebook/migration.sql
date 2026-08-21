-- Cancel-with-refund + Rebook (2026-08-21).
--
-- Two gaps this closes, both found on a live cirengs shipment that sat
-- at `picking_up` for six days because the J&T driver never collected:
--
--  1. confirm-pickup debits the merchant's prepaid shipping credit, but
--     cancel never gave it back — the merchant paid Rp 40k for a
--     delivery that never happened, and would have paid again to
--     rebook. `refundedAt` / `refundedAmount` record the give-back;
--     `refundedAt` doubles as the idempotency latch (the refund is
--     applied through a conditional UPDATE … WHERE "refundedAt" IS
--     NULL, so two concurrent cancels can't double-credit).
--
--  2. A dead shipment had no path forward. Biteship orders are
--     immutable once cancelled, so "Rebook" mints a NEW Shipment from
--     the dead one's origin/destination/item snapshots (optionally with
--     a different courier) and links the two rows in both directions.

ALTER TABLE "Shipment"
  ADD COLUMN "cancelledAt"          TIMESTAMP(3),
  ADD COLUMN "refundedAt"           TIMESTAMP(3),
  ADD COLUMN "refundedAmount"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "replacesShipmentId"   TEXT,
  ADD COLUMN "replacedByShipmentId" TEXT;

-- One rebook per dead shipment, and one predecessor per replacement.
CREATE UNIQUE INDEX "Shipment_replacedByShipmentId_key"
  ON "Shipment" ("replacedByShipmentId");

CREATE INDEX "Shipment_replacesShipmentId_idx"
  ON "Shipment" ("replacesShipmentId");

-- Backfill cancelledAt for rows already cancelled before this migration
-- so the column isn't misleadingly empty on historic shipments.
UPDATE "Shipment"
   SET "cancelledAt" = "updatedAt"
 WHERE "status" = 'cancelled' AND "cancelledAt" IS NULL;
