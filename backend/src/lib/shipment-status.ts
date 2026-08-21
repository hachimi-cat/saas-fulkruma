// Single source of truth for shipment status metadata — label,
// description, lifecycle stage. Mirrors Biteship's published list
// 1:1 (https://biteship.com/id/docs/api/trackings/status) plus our
// two internal values (pending / failed).
//
// `stage` classifies where the status sits in the lifecycle so the UI
// can render progress bars + filter chips: pre_pickup → in_flight →
// done → problem. `done` is terminal good (delivered, returned).
// `problem` is terminal bad (cancelled, disposed, etc.).

export type ShipmentStage = 'pre_pickup' | 'in_flight' | 'done' | 'problem';

export interface ShipmentStatusDescriptor {
  status: string;
  label: string;
  /** Wording shown to merchants in the dashboard timeline. */
  merchantDescription: string;
  /** Wording shown to buyers on the public tracking page. */
  buyerDescription: string;
  stage: ShipmentStage;
}

export const SHIPMENT_STATUSES: Record<string, ShipmentStatusDescriptor> = {
  // ─── Storlaunch ManualOrder.fulfillmentStatus values ────────────
  // These are storlaunch-managed; surfaced here so the same descriptor
  // module serves both the granular Biteship view + the high-level
  // ManualOrder flow on the buyer order tracking page.
  preparing: {
    status: 'preparing',
    label: 'Preparing',
    merchantDescription: 'You\'re preparing the order — packing, printing the label, etc.',
    buyerDescription: 'The seller is preparing your order.',
    stage: 'pre_pickup',
  },
  ready_to_ship: {
    status: 'ready_to_ship',
    label: 'Ready to ship',
    merchantDescription: 'Order is packed and ready. Hand it to the courier next.',
    buyerDescription: 'Your order is packed and waiting for the courier.',
    stage: 'pre_pickup',
  },
  shipped: {
    status: 'shipped',
    label: 'Shipped',
    merchantDescription: 'You\'ve handed the parcel to the courier; it\'s on its way.',
    buyerDescription: 'Your order is on its way to you.',
    stage: 'in_flight',
  },
  // ─── Biteship statuses (Fulkruma) ──────────────────────────────
  pending: {
    status: 'pending',
    label: 'Awaiting pickup',
    merchantDescription: 'Draft saved with Biteship — no courier dispatched yet. Click "Book courier" once the parcel is packed and ready.',
    buyerDescription: 'The seller is preparing your order. They\'ll hand it to the courier once it\'s ready.',
    stage: 'pre_pickup',
  },
  confirmed: {
    status: 'confirmed',
    label: 'Confirmed',
    merchantDescription: 'Order has been confirmed. The courier is locating the nearest driver to pick up.',
    buyerDescription: 'The courier has accepted the booking and is finding a driver.',
    stage: 'pre_pickup',
  },
  scheduled: {
    status: 'scheduled',
    label: 'Scheduled',
    merchantDescription: 'Pickup is scheduled for a specific date or time window.',
    buyerDescription: 'Pickup is scheduled — the driver will arrive at the seller within the booked window.',
    stage: 'pre_pickup',
  },
  allocated: {
    status: 'allocated',
    label: 'Allocated',
    merchantDescription: 'A driver has been allocated and is waiting to pick up the parcel.',
    buyerDescription: 'A driver has been assigned to your order.',
    stage: 'pre_pickup',
  },
  picking_up: {
    status: 'picking_up',
    label: 'Picking up',
    merchantDescription: 'The driver is on the way to pick up the parcel from your origin.',
    buyerDescription: 'The driver is on the way to collect your parcel from the seller.',
    stage: 'pre_pickup',
  },
  picked_up: {
    status: 'picked_up',
    label: 'Picked up',
    merchantDescription: 'The driver has the parcel and it\'s ready to be shipped.',
    buyerDescription: 'Your parcel has been collected and is on its way.',
    stage: 'in_flight',
  },
  dropping_off: {
    status: 'dropping_off',
    label: 'Out for delivery',
    merchantDescription: 'The parcel is on its way to the buyer\'s address.',
    buyerDescription: 'Your parcel is out for delivery — heading to you right now.',
    stage: 'in_flight',
  },
  on_hold: {
    status: 'on_hold',
    label: 'On hold',
    merchantDescription: 'The shipment is on hold at the courier — typically a network issue at a sorting hub. They\'ll resume once it\'s resolved.',
    buyerDescription: 'Your parcel is paused at the courier — they\'ll resume shipping it shortly.',
    stage: 'in_flight',
  },
  return_in_transit: {
    status: 'return_in_transit',
    label: 'Returning to sender',
    merchantDescription: 'The parcel couldn\'t be delivered and is on its way back to your origin.',
    buyerDescription: 'Your parcel is being returned to the seller.',
    stage: 'in_flight',
  },
  delivered: {
    status: 'delivered',
    label: 'Delivered',
    merchantDescription: 'Successfully delivered to the buyer.',
    buyerDescription: 'Your parcel has been delivered. Thanks for your order!',
    stage: 'done',
  },
  returned: {
    status: 'returned',
    label: 'Returned',
    merchantDescription: 'The parcel made the round trip back to your origin successfully.',
    buyerDescription: 'Your parcel has been returned to the seller.',
    stage: 'done',
  },
  rejected: {
    status: 'rejected',
    label: 'Rejected',
    merchantDescription: 'The courier rejected the booking — usually due to coverage, weight, or dimensions. Try another courier.',
    buyerDescription: 'The courier couldn\'t accept this shipment. The seller will arrange an alternative.',
    stage: 'problem',
  },
  rejected_by_recipient: {
    status: 'rejected_by_recipient',
    label: 'Refused by recipient',
    merchantDescription: 'The buyer refused the delivery. The parcel will be returned to your origin.',
    buyerDescription: 'You refused the delivery; the parcel is being returned to the seller.',
    stage: 'problem',
  },
  cancelled: {
    status: 'cancelled',
    label: 'Cancelled',
    merchantDescription: 'The shipment was cancelled before delivery.',
    buyerDescription: 'This shipment was cancelled.',
    stage: 'problem',
  },
  courier_not_found: {
    status: 'courier_not_found',
    label: 'No driver available',
    merchantDescription: 'No driver was available to take the booking. The shipment was cancelled — try another courier.',
    buyerDescription: 'No courier driver could be assigned. The seller will arrange another way.',
    stage: 'problem',
  },
  disposed: {
    status: 'disposed',
    label: 'Disposed',
    merchantDescription: 'The courier disposed of the parcel after repeated failed delivery + return attempts.',
    buyerDescription: 'The parcel was disposed of by the courier after repeated failed attempts.',
    stage: 'problem',
  },
  failed: {
    status: 'failed',
    label: 'Failed',
    merchantDescription: 'We couldn\'t process this shipment with the courier — typically a Biteship API error before pickup. Try again.',
    buyerDescription: 'The seller couldn\'t book the courier. They\'ll be in touch.',
    stage: 'problem',
  },
};

export function describeStatus(status: string): ShipmentStatusDescriptor {
  return SHIPMENT_STATUSES[status] ?? {
    status,
    label: status,
    merchantDescription: 'Unknown status.',
    buyerDescription: 'Unknown status.',
    stage: 'in_flight',
  };
}

// Convenience groupings for UI consumers.
export const STATUSES_BY_STAGE: Record<ShipmentStage, ShipmentStatusDescriptor[]> = {
  pre_pickup: [],
  in_flight: [],
  done: [],
  problem: [],
};
for (const d of Object.values(SHIPMENT_STATUSES)) {
  STATUSES_BY_STAGE[d.stage].push(d);
}

// Statuses that count as "still moving" — used by stats / filters
// that want a single count of active shipments. The descriptor module
// includes some storlaunch-managed ManualOrder.fulfillmentStatus
// values (preparing, ready_to_ship, shipped) which are NOT in
// Fulkruma's Prisma ShipmentStatus enum. Filter those out so Prisma
// doesn't blow up the stats endpoint with "Invalid value for enum"
// (fixed after dashboard 502 spotted 2026-05-16).
const FULKRUMA_SHIPMENT_STATUS_VALUES = new Set([
  'pending', 'confirmed', 'scheduled', 'allocated',
  'picking_up', 'picked_up', 'dropping_off',
  'on_hold', 'return_in_transit',
  'delivered', 'rejected', 'rejected_by_recipient',
  'returned', 'cancelled', 'courier_not_found',
]);

export const ACTIVE_SHIPMENT_STATUSES: string[] = [
  ...STATUSES_BY_STAGE.pre_pickup.map((d) => d.status),
  ...STATUSES_BY_STAGE.in_flight.map((d) => d.status),
].filter((s) => s !== 'pending' && FULKRUMA_SHIPMENT_STATUS_VALUES.has(s));

// ─── Cancel / rebook gates ───────────────────────────────────────
//
// Two disjoint sets, both derived from where Biteship actually lets us
// act:
//
//   CANCELLABLE — there is still a live booking to call off and the
//   parcel is provably at the merchant's origin. Biteship accepts
//   DELETE on the draft (unconfirmed) or the order (confirmed but not
//   yet collected). `picking_up` is in here on purpose: the driver is
//   en route to the merchant, so the parcel hasn't moved — this is
//   exactly the state a no-show pickup gets stuck in.
//
//   REBOOKABLE — the shipment is dead and nothing is in flight, so a
//   fresh booking is safe. Cancelled by the merchant, refused by the
//   courier, no driver found, or an API failure before dispatch.
//   `returned` / `disposed` are excluded: the parcel's round trip is
//   over and re-dispatching the same snapshot would ship it again.
//
// Everything between the two — picked_up, dropping_off, on_hold,
// return_in_transit, delivered — is untouchable: the courier has the
// parcel, so neither cancelling nor rebooking is honest.
export const CANCELLABLE_SHIPMENT_STATUSES = [
  'pending', 'confirmed', 'scheduled', 'allocated', 'picking_up',
] as const;

export const REBOOKABLE_SHIPMENT_STATUSES = [
  'cancelled', 'rejected', 'rejected_by_recipient', 'courier_not_found', 'failed',
] as const;

export function isCancellable(status: string): boolean {
  return (CANCELLABLE_SHIPMENT_STATUSES as readonly string[]).includes(status);
}

export function isRebookable(status: string): boolean {
  return (REBOOKABLE_SHIPMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * The full rebook gate, status plus the two fields that qualify it.
 *
 * Beyond the dead statuses there's one more genuinely stuck shape: a
 * `pending` row whose Biteship draft never stuck (create failed, or the
 * reference-id retries were exhausted). It looks bookable but
 * confirm-pickup 409s with NO_DRAFT forever, so it needs a fresh
 * booking, not a retry. A row already rebooked is never rebookable
 * again — follow `replacedByShipmentId` to the live one.
 */
export function canRebookShipment(shipment: {
  status: string;
  biteshipDraftOrderId?: string | null;
  replacedByShipmentId?: string | null;
}): boolean {
  if (shipment.replacedByShipmentId) return false;
  if (isRebookable(shipment.status)) return true;
  return shipment.status === 'pending' && !shipment.biteshipDraftOrderId;
}

// A cancel only earns a shipping-credit refund when the merchant was
// actually charged (confirm-pickup debits, draft creation does not) and
// the courier never took custody. Callers pair this with the
// `refundedAt IS NULL` latch for idempotency.
export function isRefundableOnCancel(shipment: {
  status: string;
  biteshipOrderId: string | null;
  price: number;
}): boolean {
  return isCancellable(shipment.status)
    && Boolean(shipment.biteshipOrderId)
    && shipment.price > 0;
}
