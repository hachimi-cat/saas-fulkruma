/** Shared types — keep in sync with the fulkruma backend. */

export interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta?: {
    requestId?: string;
    timestamp?: string;
    cursor?: string | null;
    hasMore?: boolean;
  };
}

export class FulkrumaError extends Error {
  status: number;
  code: string;
  requestId?: string;
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'FulkrumaError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

// ─── Catalogue ──────────────────────────────────────────────

export type ProductType = 'physical' | 'digital' | 'license';

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string | null;
  name: string;
  priceCents: number;
  costCents: number | null;
  lowStockThreshold: number | null;
  weight: number | null;
  isDefault: boolean;
  archived: boolean;
  externalRef: string | null;
  externalSource: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  accountId: string;
  name: string;
  sku: string | null;
  description: string | null;
  type: ProductType;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  licenseEnabled: boolean;
  maxActivations: number;
  externalRef: string | null;
  externalSource: string | null;
  archived: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
}

// ─── Inventory ──────────────────────────────────────────────

export interface Warehouse {
  id: string;
  accountId: string;
  name: string;
  address: string | null;
  city: string | null;
  postal: string | null;
  phone: string | null;
  isDefault: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VariantStock {
  id: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  updatedAt: string;
  warehouse?: { id: string; name: string };
}

export type StockMovementReason =
  | 'manual_adjust' | 'checkout_reserve' | 'checkout_commit' | 'checkout_release'
  | 'refund_restock' | 'transfer_in' | 'transfer_out' | 'damaged'
  | 'returned_to_supplier' | 'initial_stock' | 'import';

export interface StockMovement {
  id: string;
  variantId: string;
  warehouseId: string;
  delta: number;
  reason: StockMovementReason;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface StockReservation {
  id: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  checkoutSessionId: string;
  expiresAt: string;
  consumedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
}

// ─── Addresses + Shipping ────────────────────────────────────

export interface CustomerAddress {
  id: string;
  customerId: string;
  accountId: string;
  label: string;
  contactName: string;
  contactPhone: string;
  email: string | null;
  address: string;
  note: string | null;
  postalCode: string | null;
  areaId: string | null;
  lat: number | null;
  lng: number | null;
  biteshipLocationId: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ShipmentStatus =
  | 'pending' | 'confirmed' | 'allocated' | 'picking_up' | 'picked_up'
  | 'dropping_off' | 'in_transit' | 'delivered' | 'cancelled' | 'returned' | 'failed';

export interface Shipment {
  id: string;
  accountId: string;
  productId: string | null;
  checkoutSessionId: string | null;
  customerId: string | null;
  customerEmail: string | null;
  biteshipOrderId: string;
  biteshipTrackingId: string | null;
  waybillId: string | null;
  courierCode: string;
  courierServiceCode: string;
  courierType: string;
  status: ShipmentStatus;
  trackingUrl: string | null;
  labelUrl: string | null;
  price: number;
  insurance: number;
  insured: boolean;
  originSnapshot: Record<string, unknown>;
  destinationSnapshot: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  cancelReason: string | null;
  externalSource: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Digital fulfilment ─────────────────────────────────────

export type LicenseStatus = 'active' | 'revoked';

export interface License {
  id: string;
  accountId: string;
  productId: string;
  customerId: string;
  key: string;
  status: LicenseStatus;
  activations: number;
  maxActivations: number;
  expiresAt: string | null;
  externalSource: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseActivation {
  id: string;
  licenseId: string;
  instanceId: string;
  activatedAt: string;
  deactivatedAt: string | null;
}

export interface Delivery {
  id: string;
  accountId: string;
  productId: string;
  customerId: string;
  checkoutSessionId: string;
  downloadCount: number;
  maxDownloads: number;
  expiresAt: string;
  externalSource: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Partner billing ────────────────────────────────────────

export interface PartnerWorkspace {
  accountId: string;
  partner: string;
  discountRate: number;
  brandName: string | null;
  businessEmail: string | null;
  createdAt: string;
}

export interface PartnerUsageSummary {
  partner: string;
  period: { from: string; to: string };
  totals: {
    shipments: number;
    licensesIssued: number;
    deliveries: number;
    /** Sum of all monetised events × frozen discount rate, IDR cents. */
    chargeableCents: number;
  };
  byMerchant: Array<{
    accountId: string;
    shipments: number;
    licensesIssued: number;
    deliveries: number;
    chargeableCents: number;
  }>;
}

// ─── Tracking detail (F-008) ─────────────────────────────────
export interface BiteshipTrackingEventDetail {
  status: string;
  note?: string;
  updated_at: string;
  service_type?: string;
}

export interface BiteshipTrackingDetail {
  id: string;
  waybill_id?: string;
  status: string;
  courier: {
    company: string;
    type?: string;
    driver_name?: string;
    driver_phone?: string;
    driver_photo_url?: string;
    driver_plate_number?: string;
  };
  origin?: { contact_name?: string; address?: string };
  destination?: { contact_name?: string; address?: string };
  history: BiteshipTrackingEventDetail[];
  link?: string;
  order_id?: string;
}

// ─── Webhook events ─────────────────────────────────────────

export interface WebhookEventEnvelope<T = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  accountId: string | null;
  data: T;
  metadata: Record<string, unknown>;
}
