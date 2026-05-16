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
    label: 'Pending',
    merchantDescription: 'We\'ve booked the shipment with the courier and are waiting for them to confirm.',
    buyerDescription: 'Your order is being prepared — the courier hasn\'t accepted the booking yet.',
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
// that want a single count of active shipments.
export const ACTIVE_SHIPMENT_STATUSES: string[] = [
  ...STATUSES_BY_STAGE.pre_pickup.map((d) => d.status),
  ...STATUSES_BY_STAGE.in_flight.map((d) => d.status),
].filter((s) => s !== 'pending'); // pending = not yet courier-confirmed
