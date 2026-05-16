-- F-003: Expand ShipmentStatus to mirror Biteship's published status
-- list 1:1 (https://biteship.com/id/docs/api/trackings/status). The
-- previous STATUS_MAP collapsed scheduled→confirmed, on_hold→in_transit,
-- rejected→cancelled, rejected_by_recipient→returned, and dropped
-- return_in_transit entirely — hiding mid-flight states from the
-- merchant + buyer timeline. Now we preserve every Biteship status
-- verbatim.
--
-- Internal-only values that survive: `pending` (pre-courier confirm)
-- and `failed` (adapter-level error). The earlier `in_transit` value
-- was our internal invention and is removed in favour of the
-- granular dropping_off / on_hold / return_in_transit Biteship emits.
--
-- Postgres requires each ADD VALUE outside an explicit transaction;
-- Prisma migrations satisfy that by running statements separately.

ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'on_hold';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'rejected_by_recipient';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'courier_not_found';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'disposed';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'return_in_transit';
