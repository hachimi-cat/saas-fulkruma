-- F-004: Use Biteship Draft Orders as the default booking path.
--
-- Before this change, every shipment.create call hit POST /v1/orders,
-- which immediately allocates a driver. That doesn't fit food/handmade
-- merchants who need cook/pack time after the buyer pays. Biteship's
-- own Draft Orders API solves this: create a draft (no charge, no
-- driver), let the merchant click "Book courier" when ready, then
-- POST /v1/draft_orders/:id/confirm fires the real allocation.
--
-- Schema impact:
--   - biteshipDraftOrderId: present from creation, unique
--   - biteshipOrderId: now nullable; gets populated on confirm

ALTER TABLE "Shipment"
  ADD COLUMN "biteshipDraftOrderId" TEXT;

ALTER TABLE "Shipment"
  ALTER COLUMN "biteshipOrderId" DROP NOT NULL;

CREATE UNIQUE INDEX "Shipment_biteshipDraftOrderId_key"
  ON "Shipment" ("biteshipDraftOrderId");
