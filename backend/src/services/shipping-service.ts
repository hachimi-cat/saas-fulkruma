import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CourierType = 'regular' | 'instant' | 'same_day' | 'overnight' | 'economy' | 'cargo';

export interface BiteshipArea {
  id: string;
  name: string;
  country_name: string;
  country_code: string;
  administrative_division_level_1_name: string; // province
  administrative_division_level_2_name: string; // city
  administrative_division_level_3_name: string; // district
  postal_code: number;
}

export interface ShippingDestination {
  contactName: string;
  contactPhone: string;
  email?: string;
  address: string;
  note?: string;
  postalCode?: string;
  areaId?: string;
  lat?: number;
  lng?: number;
}

export interface ShippingOrigin {
  contactName: string;
  contactPhone: string;
  address: string;
  postalCode?: string;
  areaId?: string;
  lat?: number;
  lng?: number;
  note?: string; // Landmark/hint for pickup courier (→ Biteship origin_note)
}

export interface ShippingItem {
  name: string;
  description?: string;
  category?: string;
  value: number; // in currency smallest unit (IDR rupiah)
  weight: number; // grams
  length?: number; // cm
  width?: number;
  height?: number;
  quantity: number;
  productId?: string;
}

export interface BiteshipRate {
  courier_name: string;
  courier_code: string;
  courier_service_name: string;
  courier_service_code: string;
  courier_type: string;
  description: string;
  duration: string; // e.g. "2-3 days"
  shipment_duration_range: string;
  shipment_duration_unit: string;
  service_type: string; // regular | instant | same_day | overnight | economy
  shipping_type: string;
  price: number; // IDR
  type: string;
  available_for_cash_on_delivery: boolean;
  available_for_proof_of_delivery: boolean;
  available_for_instant_waybill_id: boolean;
  available_for_insurance: boolean;
  company: string;
}

export interface RateQuoteParams {
  origin: ShippingOrigin;
  destination: ShippingDestination;
  items: ShippingItem[];
  couriers?: string[]; // courier codes to quote; defaults to full list
  insurance?: boolean;
}

export interface CreateOrderParams {
  referenceId: string; // our shipmentId
  origin: ShippingOrigin;
  destination: ShippingDestination;
  items: ShippingItem[];
  courierCompany: string;
  courierType: string;
  courierInsurance?: number; // item value for insurance coverage
  deliveryType?: 'now' | 'later' | 'scheduled';
  deliveryDate?: string;
  note?: string;
  // When set, Biteship uses the stored Location record for validated geocoding
  // instead of the inline origin/destination payload. Preferred for instant couriers.
  originLocationId?: string;
  destinationLocationId?: string;
}

export interface BiteshipOrder {
  id: string;
  status: string;
  waybill_id?: string;
  courier: { company: string; type: string; tracking_id?: string };
  price: number;
  reference_id: string;
  tracking?: { url?: string };
  label?: string; // PDF URL
}

// Returned by POST /v1/draft_orders. Shape is the same as a regular
// order minus waybill / tracking / label fields — those only appear
// after the draft is confirmed (POST /v1/draft_orders/:id/confirm).
export interface BiteshipDraftOrder {
  id: string;
  status: 'placed' | 'ready' | 'confirmed';
  courier?: { company: string; type: string };
  price?: number;
  reference_id?: string;
}

export interface BiteshipTrackingEvent {
  status: string;
  note?: string;
  updated_at: string; // ISO
  service_type?: string;
}

export interface BiteshipTracking {
  id: string;
  waybill_id?: string;
  status: string;
  courier: {
    company: string;
    driver_name?: string;
    driver_phone?: string;
    driver_photo_url?: string;
    driver_plate_number?: string;
  };
  origin?: { contact_name?: string; address?: string };
  destination?: { contact_name?: string; address?: string };
  history: BiteshipTrackingEvent[];
  link?: string;
  order_id?: string;
}

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

export interface BiteshipLocationParams {
  name: string;
  contactName: string;
  contactPhone: string;
  address: string;
  postalCode?: string;
  areaId?: string;
  lat?: number;
  lng?: number;
  type: 'origin' | 'destination';
  note?: string;
}

export interface BiteshipLocation {
  id: string;
  name: string;
  contact_name: string;
  contact_phone: string;
  address: string;
  note?: string;
  postal_code?: string | number;
  latitude?: number;
  longitude?: number;
  type: 'origin' | 'destination';
}

export interface ParsedWebhook {
  event: string; // e.g. "order.status_updated"
  orderId: string; // biteship order id
  waybillId?: string;
  status: string; // biteship status string
  occurredAt: Date;
  note?: string;
  raw: Record<string, unknown>;
}

import { isInsufficientBalanceError, fireLowBalanceAlert } from './biteship-balance-alert.js';

export class BiteshipError extends Error {
  constructor(public readonly status: number, message: string, public readonly body?: unknown) {
    super(message);
    this.name = 'BiteshipError';
  }
}

// ─── Biteship Adapter ────────────────────────────────────────────────────────

const BITESHIP_BASE_URL = 'https://api.biteship.com';

// Module-level cache for GET /v1/couriers — the list changes rarely.
// Keyed by apiKey so test/live environments stay separate.
const COURIER_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const courierCache = new Map<string, { at: number; couriers: BiteshipCourier[] }>();

// Exposed for tests — do not call in production code.
export function __clearCourierCache(): void {
  courierCache.clear();
}

export class BiteshipAdapter {
  private readonly apiKey: string;
  private readonly webhookToken: string;
  private readonly isSandbox: boolean;

  constructor(opts: { apiKey: string; webhookToken?: string; sandbox: boolean }) {
    this.apiKey = opts.apiKey;
    this.webhookToken = opts.webhookToken ?? '';
    this.isSandbox = opts.sandbox;
  }

  // Biteship uses raw JWT in Authorization header — no "Bearer" prefix.
  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': this.apiKey,
    };
  }

  private async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const url = `${BITESHIP_BASE_URL}${path}`;
    let attempt = 0;
    const maxAttempts = 2;
    let lastErr: unknown;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        const response = await fetch(url, {
          method,
          headers: this.headers(),
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await response.text();
        const parsed = text ? JSON.parse(text) : {};
        if (!response.ok) {
          // Retry 5xx once
          if (response.status >= 500 && attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 300 * attempt));
            continue;
          }
          // S-052: detect "Saldo is empty" — Biteship has no balance
          // API so the only signal is an error response. Fire a
          // throttled email alert so ops can manually top up before
          // the next merchant's confirmPickup fails.
          if (isInsufficientBalanceError(parsed)) {
            fireLowBalanceAlert({
              operation: `${method} ${path}`,
              biteshipResponseBody: parsed,
            });
          }
          throw new BiteshipError(response.status, (parsed as { error?: string }).error ?? `Biteship ${response.status}`, parsed);
        }
        return parsed as T;
      } catch (err) {
        lastErr = err;
        if (err instanceof BiteshipError) throw err;
        if (attempt >= maxAttempts) break;
        await new Promise(r => setTimeout(r, 300 * attempt));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Biteship request failed');
  }

  // ─── Areas (autocomplete for postal/city) ────────────────────────────
  async searchAreas(query: string, countries: string = 'ID', type: 'single' | 'double' = 'single'): Promise<BiteshipArea[]> {
    const q = encodeURIComponent(query);
    const data = await this.request<{ success: boolean; areas: BiteshipArea[] }>('GET', `/v1/maps/areas?countries=${countries}&input=${q}&type=${type}`);
    return data.areas ?? [];
  }

  // ─── Rates ───────────────────────────────────────────────────────────
  async getRates(params: RateQuoteParams): Promise<BiteshipRate[]> {
    const couriers = (params.couriers && params.couriers.length > 0)
      ? params.couriers.join(',')
      : DEFAULT_COURIERS.join(',');

    const body: Record<string, unknown> = {
      couriers,
      items: params.items.map(i => ({
        name: i.name,
        description: i.description,
        category: i.category ?? 'other',
        value: i.value,
        weight: Math.max(1, i.weight), // Biteship requires weight >= 1
        length: i.length,
        width: i.width,
        height: i.height,
        quantity: i.quantity,
      })),
    };

    // Use coordinates if both sides have them (required for instant couriers),
    // else postal code if available, else area id.
    const hasCoords = params.origin.lat != null && params.origin.lng != null
      && params.destination.lat != null && params.destination.lng != null;

    if (hasCoords) {
      body.origin_latitude = params.origin.lat;
      body.origin_longitude = params.origin.lng;
      body.destination_latitude = params.destination.lat;
      body.destination_longitude = params.destination.lng;
    }
    if (params.origin.areaId) body.origin_area_id = params.origin.areaId;
    if (params.destination.areaId) body.destination_area_id = params.destination.areaId;
    if (params.origin.postalCode) body.origin_postal_code = params.origin.postalCode;
    if (params.destination.postalCode) body.destination_postal_code = params.destination.postalCode;

    const data = await this.request<{ success: boolean; pricing: BiteshipRate[] }>('POST', '/v1/rates/couriers', body);
    return data.pricing ?? [];
  }

  // ─── Orders ──────────────────────────────────────────────────────────
  //
  // Two paths into a confirmed Biteship order:
  //
  // 1. createOrder() — immediate dispatch. Driver gets allocated right
  //    away. Used by flows that don't need a "prep" gap (digital +
  //    physical-with-ready-stock merchants who pre-pack).
  //
  // 2. createDraftOrder() + confirmDraftOrder() — two-step booking.
  //    Draft holds no charge / no allocation. Merchant clicks "Book
  //    courier" when the parcel is actually ready, then confirm()
  //    flips it into a real order and dispatch begins. The right
  //    default for food / handmade / on-demand merchants who need
  //    cook + pack time after the buyer pays.

  private buildOrderBody(params: CreateOrderParams): Record<string, unknown> {
    const body: Record<string, unknown> = {
      reference_id: params.referenceId,
      shipper_contact_name: params.origin.contactName,
      shipper_contact_phone: params.origin.contactPhone,
      origin_location_id: params.originLocationId,
      origin_contact_name: params.origin.contactName,
      origin_contact_phone: params.origin.contactPhone,
      origin_address: params.origin.address,
      origin_note: params.origin.note ?? '',
      origin_postal_code: params.origin.postalCode,
      origin_area_id: params.origin.areaId,
      origin_coordinate: (params.origin.lat != null && params.origin.lng != null)
        ? { latitude: params.origin.lat, longitude: params.origin.lng }
        : undefined,
      destination_location_id: params.destinationLocationId,
      destination_contact_name: params.destination.contactName,
      destination_contact_phone: params.destination.contactPhone,
      destination_contact_email: params.destination.email,
      destination_address: params.destination.address,
      destination_note: params.destination.note ?? '',
      destination_postal_code: params.destination.postalCode,
      destination_area_id: params.destination.areaId,
      destination_coordinate: (params.destination.lat != null && params.destination.lng != null)
        ? { latitude: params.destination.lat, longitude: params.destination.lng }
        : undefined,
      courier_company: params.courierCompany,
      courier_type: params.courierType,
      courier_insurance: params.courierInsurance,
      delivery_type: params.deliveryType ?? 'now',
      delivery_date: params.deliveryDate,
      order_note: params.note,
      items: params.items.map(i => ({
        name: i.name,
        description: i.description,
        category: i.category ?? 'other',
        value: i.value,
        weight: Math.max(1, i.weight),
        quantity: i.quantity,
      })),
    };
    for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
    return body;
  }

  async createOrder(params: CreateOrderParams): Promise<BiteshipOrder> {
    return await this.request<BiteshipOrder>('POST', '/v1/orders', this.buildOrderBody(params));
  }

  async createDraftOrder(params: CreateOrderParams): Promise<BiteshipDraftOrder> {
    return await this.request<BiteshipDraftOrder>('POST', '/v1/draft_orders', this.buildOrderBody(params));
  }

  /** Confirms a draft and creates the real order (charges + dispatch). */
  async confirmDraftOrder(draftOrderId: string): Promise<BiteshipOrder> {
    return await this.request<BiteshipOrder>('POST', `/v1/draft_orders/${encodeURIComponent(draftOrderId)}/confirm`, {});
  }

  /** Delete an unconfirmed draft — no Biteship charge, soft cancel. */
  async deleteDraftOrder(draftOrderId: string): Promise<{ success: boolean }> {
    return await this.request<{ success: boolean }>('DELETE', `/v1/draft_orders/${encodeURIComponent(draftOrderId)}`);
  }

  async getOrder(orderId: string): Promise<BiteshipOrder> {
    return await this.request<BiteshipOrder>('GET', `/v1/orders/${orderId}`);
  }

  async cancelOrder(orderId: string, reason: string = 'Merchant cancelled'): Promise<{ success: boolean }> {
    return await this.request<{ success: boolean }>('DELETE', `/v1/orders/${orderId}?cancellation_reason=${encodeURIComponent(reason)}`);
  }

  async trackWaybill(waybillId: string, courierCode: string): Promise<{ history: BiteshipTrackingEvent[]; status: string }> {
    const data = await this.request<{ history: BiteshipTrackingEvent[]; status: string }>(
      'GET',
      `/v1/trackings/${encodeURIComponent(waybillId)}/couriers/${encodeURIComponent(courierCode)}`
    );
    return data;
  }

  // Tracking by Biteship tracking_id (only available for orders placed via Biteship).
  // Returns richer data including driver info — critical for instant couriers.
  async getTrackingById(trackingId: string): Promise<BiteshipTracking> {
    return await this.request<BiteshipTracking>('GET', `/v1/trackings/${encodeURIComponent(trackingId)}`);
  }

  // ─── Couriers ────────────────────────────────────────────────────────
  // Fetches the dynamic list of courier services enabled for this account.
  // Cached at module scope for 1 hour per apiKey.
  async listCouriers(): Promise<BiteshipCourier[]> {
    const cached = courierCache.get(this.apiKey);
    if (cached && Date.now() - cached.at < COURIER_CACHE_TTL_MS) {
      return cached.couriers;
    }
    const data = await this.request<{ success: boolean; couriers: BiteshipCourier[] }>('GET', '/v1/couriers');
    const couriers = data.couriers ?? [];
    courierCache.set(this.apiKey, { at: Date.now(), couriers });
    return couriers;
  }

  // ─── Locations (saved pickup/drop-off addresses) ─────────────────────
  async createLocation(params: BiteshipLocationParams): Promise<BiteshipLocation> {
    const body: Record<string, unknown> = {
      name: params.name,
      contact_name: params.contactName,
      contact_phone: params.contactPhone,
      address: params.address,
      note: params.note,
      postal_code: params.postalCode,
      latitude: params.lat,
      longitude: params.lng,
      type: params.type,
    };
    for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
    return await this.request<BiteshipLocation>('POST', '/v1/locations', body);
  }

  async getLocation(id: string): Promise<BiteshipLocation> {
    return await this.request<BiteshipLocation>('GET', `/v1/locations/${encodeURIComponent(id)}`);
  }

  // Biteship uses POST (not PATCH) for partial updates on the Locations resource.
  async updateLocation(id: string, params: Partial<BiteshipLocationParams>): Promise<BiteshipLocation> {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.contactName !== undefined) body.contact_name = params.contactName;
    if (params.contactPhone !== undefined) body.contact_phone = params.contactPhone;
    if (params.address !== undefined) body.address = params.address;
    if (params.note !== undefined) body.note = params.note;
    if (params.postalCode !== undefined) body.postal_code = params.postalCode;
    if (params.lat !== undefined) body.latitude = params.lat;
    if (params.lng !== undefined) body.longitude = params.lng;
    if (params.type !== undefined) body.type = params.type;
    return await this.request<BiteshipLocation>('POST', `/v1/locations/${encodeURIComponent(id)}`, body);
  }

  async deleteLocation(id: string): Promise<{ success: boolean; id?: string; message?: string }> {
    return await this.request<{ success: boolean; id?: string; message?: string }>('DELETE', `/v1/locations/${encodeURIComponent(id)}`);
  }

  // ─── Webhook signature ───────────────────────────────────────────────
  // Biteship webhooks send X-Biteship-Signature: HMAC-SHA256(body, webhook_secret)
  verifyWebhook(signature: string | undefined, rawBody: string): boolean {
    if (!this.webhookToken) {
      // No token configured:
      //   - If caller PROVIDED a signature, we cannot verify it — reject. Failing
      //     closed means an attacker can't bypass verification by sending a bogus
      //     sig to an environment that forgot to set the token.
      //   - If no signature was provided, accept only in sandbox (dev convenience).
      if (signature) return false;
      return this.isSandbox;
    }
    if (!signature) return false;
    const expected = crypto.createHmac('sha256', this.webhookToken).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  parseWebhook(body: Record<string, unknown>): ParsedWebhook {
    const event = String(body.event ?? 'order.status_updated');
    const order = (body.order ?? body) as Record<string, unknown>;
    const courier = (body.courier ?? order.courier ?? {}) as Record<string, unknown>;
    const status = String(body.status ?? order.status ?? 'pending');
    return {
      event,
      orderId: String(body.order_id ?? order.id ?? ''),
      waybillId: (body.waybill_id ?? courier.waybill_id) ? String(body.waybill_id ?? courier.waybill_id) : undefined,
      status,
      occurredAt: body.updated_at ? new Date(String(body.updated_at)) : new Date(),
      note: body.note ? String(body.note) : undefined,
      raw: body,
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Build a BiteshipAdapter with a specific (per-merchant) API key. Falls back
 * to env vars if no key is provided — useful for the public /shipping/couriers
 * catalog endpoint that runs against Fulkruma's own demo account.
 */
export function createBiteshipAdapter(opts?: {
  apiKey?: string | null;
  environment?: 'test' | 'live';
}): BiteshipAdapter {
  const envToggle = process.env.BITESHIP_ENV ?? 'test';
  const isSandbox = opts?.environment ? opts.environment === 'test' : envToggle !== 'live';
  const fallbackKey = isSandbox
    ? (process.env.BITESHIP_TEST_API_KEY ?? process.env.BITESHIP_API_KEY ?? '')
    : (process.env.BITESHIP_API_KEY ?? '');
  const apiKey = opts?.apiKey ?? fallbackKey;
  return new BiteshipAdapter({
    apiKey,
    webhookToken: process.env.BITESHIP_WEBHOOK_TOKEN,
    sandbox: isSandbox,
  });
}

/** Resolve the Biteship adapter for a specific merchant — reads the API
 *  key from BiteshipConfig.apiKey, falling back to env var. */
export async function getAdapterForAccount(
  prisma: Pick<PrismaClient, 'biteshipConfig'>,
  accountId: string,
): Promise<BiteshipAdapter> {
  const cfg = await prisma.biteshipConfig.findUnique({ where: { accountId } });
  return createBiteshipAdapter({ apiKey: cfg?.apiKey ?? null });
}

// ─── Courier catalog ─────────────────────────────────────────────────────────
// All 16 couriers approved on the Biteship activation form, using the
// canonical Biteship courier_code values. The most common gotcha:
// Biteship returns `gojek` for the GoSend service (company name, not
// product name) — using `gosend` causes "Unknown couriers: gosend"
// validation failures because Biteship's live catalog doesn't list it.
export const DEFAULT_COURIERS = [
  'jne', 'jnt', 'pos', 'sicepat', 'wahana', 'sap', 'ninja', 'tiki',
  'lion', 'anteraja', 'idexpress', 'lalamove', 'grab', 'deliveree', 'gojek', 'borzo',
] as const;

// Biteship's canonical code is `gojek` not `gosend` (see DEFAULT_COURIERS).
export const INSTANT_COURIERS = new Set(['gojek', 'grab', 'lalamove', 'borzo', 'deliveree']);

export function isInstantCourier(courierCode: string): boolean {
  return INSTANT_COURIERS.has(courierCode);
}

// ─── Status mapping ──────────────────────────────────────────────────────────
//
// 1:1 mirror of Biteship's status enum into our ShipmentStatus. The
// only translation is `picked` → `picked_up` (Biteship has used both
// spellings historically; we normalise to one). Anything we don't
// recognise is logged and falls through to `pending` so the system
// stays safe — but the goal is for this list to stay exhaustive.
// 1:1 with Biteship's published status list. Accepts both the
// camelCase form the docs show in examples and the snake_case form
// the webhook actually delivers. `picked` is Biteship's terminology
// for "picked up" — normalised to picked_up internally.
const STATUS_MAP: Record<string, string> = {
  // snake_case (webhook payloads)
  'confirmed': 'confirmed',
  'scheduled': 'scheduled',
  'allocated': 'allocated',
  'picking_up': 'picking_up',
  'picked': 'picked_up',
  'picked_up': 'picked_up',
  'dropping_off': 'dropping_off',
  'on_hold': 'on_hold',
  'return_in_transit': 'return_in_transit',
  'delivered': 'delivered',
  'rejected': 'rejected',
  'rejected_by_recipient': 'rejected_by_recipient',
  'returned': 'returned',
  'cancelled': 'cancelled',
  'courier_not_found': 'courier_not_found',
  'disposed': 'disposed',
  // camelCase aliases (docs examples — defensive in case the API ever
  // shifts to camelCase on us)
  'pickingup': 'picking_up',
  'droppingoff': 'dropping_off',
  'onhold': 'on_hold',
  'returnintransit': 'return_in_transit',
  'couriernotfound': 'courier_not_found',
};

export function mapBiteshipStatus(biteshipStatus: string): string {
  const key = biteshipStatus.toLowerCase();
  const mapped = STATUS_MAP[key];
  if (!mapped) {
    console.warn(`[biteship] unknown status "${biteshipStatus}" — falling back to pending`);
    return 'pending';
  }
  return mapped;
}

// ─── Service: orchestration over adapter + prisma ───────────────────────────

export interface QuoteRatesInput {
  accountId: string;
  destination: ShippingDestination;
  items: ShippingItem[];
  insurance?: boolean;
}

type PrismaLike = Pick<PrismaClient, 'biteshipConfig' | 'shipment' | 'shipmentEvent'>;

/**
 * Resolve merchant's shipping origin from BiteshipConfig. Throws if incomplete.
 */
export async function resolveOrigin(
  prisma: Pick<PrismaClient, 'biteshipConfig'>,
  accountId: string,
): Promise<ShippingOrigin> {
  const cfg = await prisma.biteshipConfig.findUnique({ where: { accountId } });
  if (!cfg) throw new Error(`BiteshipConfig for account ${accountId} not found`);
  if (!cfg.originAddress || !cfg.contactName || !cfg.contactPhone) {
    throw new Error('Shipping origin not configured');
  }
  return {
    contactName: cfg.contactName,
    contactPhone: cfg.contactPhone,
    address: cfg.originAddress,
    postalCode: cfg.originPostal ?? undefined,
    areaId: cfg.originAreaId ?? undefined,
    lat: cfg.originLat ?? undefined,
    lng: cfg.originLng ?? undefined,
    note: cfg.originNote ?? undefined,
  };
}

export function getEnabledCouriers(cfg: { enabledCouriers: unknown }): string[] {
  const c = cfg.enabledCouriers;
  if (Array.isArray(c) && c.length > 0) return c as string[];
  return [...DEFAULT_COURIERS];
}

/**
 * Quote rates for a merchant + destination + items. Filters out instant couriers
 * when destination lacks lat/lng. Sorted by price asc.
 */
export async function quoteRates(
  prisma: PrismaLike,
  input: QuoteRatesInput,
  adapter?: BiteshipAdapter,
): Promise<BiteshipRate[]> {
  const origin = await resolveOrigin(prisma, input.accountId);
  const cfg = await prisma.biteshipConfig.findUnique({ where: { accountId: input.accountId } });
  const enabled = cfg ? getEnabledCouriers(cfg) : [...DEFAULT_COURIERS];

  const hasCoords = input.destination.lat != null && input.destination.lng != null;
  const couriers = hasCoords ? enabled : enabled.filter(c => !isInstantCourier(c));

  const ad = adapter ?? createBiteshipAdapter({ apiKey: cfg?.apiKey ?? null });
  const rates = await ad.getRates({
    origin,
    destination: input.destination,
    items: input.items,
    couriers,
    insurance: input.insurance,
  });

  return rates.sort((a, b) => a.price - b.price);
}

export async function cancelShipment(
  prisma: PrismaLike,
  shipmentId: string,
  reason: string,
  adapter?: BiteshipAdapter,
): Promise<void> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);
  // Once the parcel has left the origin we can't cancel — Biteship
  // refuses, so we refuse upstream. F-003 removed our internal
  // 'in_transit' value; the real Biteship lifecycle uses on_hold /
  // dropping_off / return_in_transit between picked_up and delivered.
  if ([
    'picked_up', 'dropping_off', 'on_hold', 'return_in_transit',
    'delivered', 'cancelled', 'returned', 'disposed',
  ].includes(shipment.status)) {
    throw new Error(`Cannot cancel shipment in status ${shipment.status}`);
  }
  const ad = adapter ?? await getAdapterForAccount(prisma, shipment.accountId);
  // F-004: confirmed shipments cancel via /v1/orders; unconfirmed
  // drafts (biteshipOrderId still null) cancel via /v1/draft_orders.
  if (shipment.biteshipOrderId) {
    await ad.cancelOrder(shipment.biteshipOrderId, reason);
  } else if (shipment.biteshipDraftOrderId) {
    await ad.deleteDraftOrder(shipment.biteshipDraftOrderId);
  }
  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { status: 'cancelled', cancelReason: reason },
  });
  await prisma.shipmentEvent.create({
    data: {
      shipmentId,
      status: 'cancelled',
      note: reason,
      occurredAt: new Date(),
      raw: {} as never,
    },
  });
}

/**
 * Handle Biteship webhook. Appends ShipmentEvent and updates Shipment.status.
 * Returns the shipment id, or null if no matching shipment.
 */
export async function handleWebhook(
  prisma: PrismaLike,
  parsed: ParsedWebhook,
): Promise<{ shipmentId: string; status: string } | null> {
  const shipment = await prisma.shipment.findUnique({ where: { biteshipOrderId: parsed.orderId } });
  if (!shipment) return null;

  const mapped = mapBiteshipStatus(parsed.status);

  await prisma.shipmentEvent.create({
    data: {
      shipmentId: shipment.id,
      status: mapped as never,
      note: parsed.note,
      occurredAt: parsed.occurredAt,
      raw: parsed.raw as never,
    },
  });

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: mapped as never,
      waybillId: parsed.waybillId ?? shipment.waybillId,
    },
  });

  return { shipmentId: shipment.id, status: mapped };
}
