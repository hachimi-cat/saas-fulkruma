/**
 * Fetch wrapper for the Fulkruma backend, called via the same-origin
 * portal proxy at /api/v1/fulkruma/*.
 *
 * Always returns the unwrapped `data` block from the Forjio API
 * envelope, throws an `ApiError` carrying the envelope's `error.code`
 * + message on failure. The portal `useEffect` callers handle the
 * thrown error (set local state, surface in UI).
 */

export class ApiError extends Error {
  code: string;
  status: number;
  detail?: unknown;
  constructor(code: string, message: string, status: number, detail?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

interface Envelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta?: unknown;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith('/') ? `/api/v1/fulkruma${path}` : `/api/v1/fulkruma/${path}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  // Workspace context is handled server-side via the
  // `fulkruma_active_workspace` cookie (set by /dashboard/workspaces
  // switcher), so client requests don't need an explicit override.
  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  let body: Envelope<T> | { error?: { code: string; message: string } };
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError('INVALID_RESPONSE', `${res.status} non-JSON response`, res.status);
  }
  if (!res.ok || (body as Envelope<T>).error) {
    const e = (body as Envelope<T>).error ?? { code: `HTTP_${res.status}`, message: res.statusText };
    throw new ApiError(e.code, e.message, res.status, body);
  }
  return (body as Envelope<T>).data as T;
}

// ─── Typed shape definitions used across pages ──────────────────────

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
  warehouse: { id: string; name: string };
}

export interface StockMovement {
  id: string;
  variantId: string;
  warehouseId: string;
  delta: number;
  reason: string;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  contactName: string;
  contactPhone: string;
  email: string | null;
  address: string;
  postalCode: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentEvent {
  id: string;
  shipmentId: string;
  status: string;
  note: string | null;
  occurredAt: string;
}

export interface Shipment {
  id: string;
  status: string;
  courierCode: string;
  courierServiceCode: string;
  courierType: string;
  waybillId: string | null;
  trackingUrl: string | null;
  price: number;
  customerEmail: string | null;
  customerId: string | null;
  checkoutSessionId: string | null;
  originSnapshot: Record<string, unknown>;
  destinationSnapshot: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
  events?: ShipmentEvent[];
}

export interface License {
  id: string;
  productId: string;
  customerId: string;
  key: string;
  status: 'active' | 'revoked';
  activations: number;
  maxActivations: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface Delivery {
  id: string;
  productId: string;
  customerId: string;
  checkoutSessionId: string;
  downloadCount: number;
  maxDownloads: number;
  expiresAt: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyId: string;
  secretPreview: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  active: boolean;
  createdAt: string;
  secretPreview: string | null;
}

export interface WebhookEventRow {
  id: string;
  endpointId: string;
  type: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  responseCode: number | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  actorType: string;
  actorEmail: string | null;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface BiteshipConfig {
  accountId: string;
  apiKeyConfigured: boolean;
  apiKeyPreview: string | null;
  defaultOriginId: string | null;
  enabledCouriers: string[];
  defaultCourier: string | null;
  active: boolean;
}

/** A single Biteship courier service row, returned by GET /shipping/couriers.
 *  One courier (e.g. JNE) typically has multiple rows — one per service tier.
 */
export interface BiteshipCourier {
  courier_name: string;
  courier_code: string;
  courier_service_name: string;
  courier_service_code: string;
  tier?: string;
  description?: string;
  service_type: string; // same_day | next_day | regular | cargo | instant
  shipping_type?: string;
  shipment_duration_range?: string;
  shipment_duration_unit?: string;
  available_for_cash_on_delivery: boolean;
  available_for_proof_of_delivery: boolean;
  available_for_instant_waybill_id: boolean;
  available_for_insurance?: boolean;
}

export interface OverviewStats {
  counters: {
    activeWarehouses: number;
    skuCount: number;
    shipmentsInTransit: number;
    activeLicenses: number;
    deliveries30d: number;
    openReservations: number;
    pendingShipments: number;
    deliveredLast30d: number;
  };
  recent: {
    shipments: Array<{
      id: string;
      status: string;
      courierCode: string;
      waybillId: string | null;
      customerEmail: string | null;
      updatedAt: string;
    }>;
    movements: Array<{
      id: string;
      variantId: string;
      delta: number;
      reason: string;
      createdAt: string;
      warehouse: { name: string };
    }>;
  };
}
