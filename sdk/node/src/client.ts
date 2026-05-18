import crypto from 'node:crypto';
import {
  ApiEnvelope,
  Product,
  ProductVariant,
  Warehouse,
  VariantStock,
  StockMovement,
  StockReservation,
  CustomerAddress,
  Shipment,
  License,
  LicenseActivation,
  Delivery,
  PartnerWorkspace,
  PartnerUsageSummary,
  FulkrumaError,
  StockMovementReason,
  ProductType,
  BiteshipTrackingDetail,
} from './types.js';

export interface FulkrumaClientOptions {
  /** HMAC access key id, e.g. 'AKIAFULK<random>'. */
  keyId: string;
  /** HMAC secret. */
  secret: string;
  /** Base URL. Default https://fulkruma.com. */
  baseUrl?: string;
  /** Optional merchant accountId — forwarded as `X-Fulkruma-On-Behalf-Of`.
   *  Only allowed when `keyId` holds the `fulkruma:platform:admin` scope. */
  onBehalfOf?: string;
  /** Per-request fetch timeout. Default 30s. */
  timeoutMs?: number;
}

interface SignInput {
  method: string;
  path: string;
  body: string | null;
  idempotencyKey?: string;
}

export interface FetchArgs {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  /** Per-call override for onBehalfOf when reusing a platform client across merchants. */
  onBehalfOf?: string;
}

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return '';
  const u = new URLSearchParams();
  for (const [k, v] of entries) u.set(k, String(v));
  return `?${u.toString()}`;
}

// ─── Input shapes (extracted so update/patch can reference Partial<…>) ──

export interface ProductCreateInput {
  name: string;
  sku?: string;
  description?: string;
  type?: ProductType;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  licenseEnabled?: boolean;
  maxActivations?: number;
  externalRef?: string;
  externalSource?: string;
}

export interface VariantCreateInput {
  name: string;
  sku?: string;
  priceCents?: number;
  costCents?: number;
  lowStockThreshold?: number;
  weight?: number;
  isDefault?: boolean;
  externalRef?: string;
  externalSource?: string;
}

export interface WarehouseCreateInput {
  name: string;
  address?: string;
  city?: string;
  postal?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  isDefault?: boolean;
}

export class FulkrumaClient {
  private readonly keyId: string;
  private readonly secret: string;
  private readonly baseUrl: string;
  private readonly defaultOnBehalfOf: string | undefined;
  private readonly timeoutMs: number;

  constructor(opts: FulkrumaClientOptions) {
    if (!opts.keyId || !opts.secret) {
      throw new Error('FulkrumaClient: keyId and secret are required');
    }
    this.keyId = opts.keyId;
    this.secret = opts.secret;
    this.baseUrl = (opts.baseUrl ?? 'https://fulkruma.com').replace(/\/+$/, '');
    this.defaultOnBehalfOf = opts.onBehalfOf;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  /** Clone this client scoped to a specific merchant. Use with platform-admin keys. */
  forMerchant(accountId: string): FulkrumaClient {
    return new FulkrumaClient({
      keyId: this.keyId,
      secret: this.secret,
      baseUrl: this.baseUrl,
      onBehalfOf: accountId,
      timeoutMs: this.timeoutMs,
    });
  }

  // ─── Low-level request ──────────────────────────────────────

  private sign({ method, path, body, idempotencyKey }: SignInput): { signature: string; timestamp: string } {
    const ts = String(Math.floor(Date.now() / 1000));
    const bodyHash = crypto.createHash('sha256').update(body ?? '').digest('hex');
    const idem = idempotencyKey ? `\n${idempotencyKey}` : '';
    const stringToSign = `${method.toUpperCase()}\n${path}\n${ts}\n${bodyHash}${idem}`;
    const signature = crypto.createHmac('sha256', this.secret).update(stringToSign).digest('hex');
    return { signature, timestamp: ts };
  }

  async request<T>(args: FetchArgs): Promise<T> {
    const bodyJson = args.body !== undefined ? JSON.stringify(args.body) : null;
    const { signature, timestamp } = this.sign({
      method: args.method,
      path: args.path,
      body: bodyJson,
      idempotencyKey: args.idempotencyKey,
    });
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Fulkruma-HMAC-SHA256 keyId=${this.keyId}, scope=*, signature=${signature}`,
      'X-Fulkruma-Timestamp': timestamp,
      ...(bodyJson ? { 'Content-Type': 'application/json' } : {}),
      ...(args.idempotencyKey ? { 'Idempotency-Key': args.idempotencyKey } : {}),
    };
    const effectiveOnBehalf = args.onBehalfOf ?? this.defaultOnBehalfOf;
    if (effectiveOnBehalf) headers['X-Fulkruma-On-Behalf-Of'] = effectiveOnBehalf;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${args.path}`, {
        method: args.method,
        headers,
        body: bodyJson ?? undefined,
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if ((e as Error).name === 'AbortError') {
        throw new FulkrumaError(0, 'timeout', `Fulkruma request timed out after ${this.timeoutMs}ms`);
      }
      throw new FulkrumaError(0, 'network_error', (e as Error).message);
    }
    clearTimeout(timer);

    const text = await res.text();
    let env: ApiEnvelope<T>;
    try { env = JSON.parse(text) as ApiEnvelope<T>; }
    catch { throw new FulkrumaError(res.status, 'invalid_response', `Non-JSON response: ${text.slice(0, 200)}`); }
    if (!res.ok || env.error) {
      const err = env.error ?? { code: 'unknown', message: `HTTP ${res.status}` };
      throw new FulkrumaError(res.status, err.code, err.message, env.meta?.requestId);
    }
    return env.data as T;
  }

  private genIdem(): string {
    return `idem_${crypto.randomUUID()}`;
  }

  // ─── Resources ──────────────────────────────────────────────

  products = {
    create: (input: ProductCreateInput) => this.request<{ product: Product }>({
      method: 'POST', path: '/api/v1/products', body: input, idempotencyKey: this.genIdem(),
    }),
    get: (id: string) => this.request<{ product: Product }>({ method: 'GET', path: `/api/v1/products/${id}` }),
    list: (params: { archived?: boolean } = {}) =>
      this.request<{ products: Product[] }>({ method: 'GET', path: `/api/v1/products${qs(params)}` }),
    update: (id: string, patch: Partial<ProductCreateInput>) =>
      this.request<{ product: Product }>({ method: 'PATCH', path: `/api/v1/products/${id}`, body: patch }),
    archive: (id: string) =>
      this.request<{ archived: boolean }>({ method: 'DELETE', path: `/api/v1/products/${id}` }),
    addVariant: (productId: string, input: VariantCreateInput) => this.request<{ variant: ProductVariant }>({
      method: 'POST', path: `/api/v1/products/${productId}/variants`, body: input,
    }),
    updateVariant: (productId: string, variantId: string, patch: Partial<VariantCreateInput>) =>
      this.request<{ variant: ProductVariant }>({
        method: 'PATCH', path: `/api/v1/products/${productId}/variants/${variantId}`, body: patch,
      }),
    archiveVariant: (productId: string, variantId: string) =>
      this.request<{ archived: boolean }>({
        method: 'DELETE', path: `/api/v1/products/${productId}/variants/${variantId}`,
      }),
  };

  warehouses = {
    create: (input: WarehouseCreateInput) =>
      this.request<{ warehouse: Warehouse }>({ method: 'POST', path: '/api/v1/warehouses', body: input }),
    list: () => this.request<{ warehouses: Warehouse[] }>({ method: 'GET', path: '/api/v1/warehouses' }),
    update: (id: string, patch: Partial<WarehouseCreateInput>) =>
      this.request<{ warehouse: Warehouse }>({ method: 'PATCH', path: `/api/v1/warehouses/${id}`, body: patch }),
    archive: (id: string) =>
      this.request<{ archived: boolean }>({ method: 'DELETE', path: `/api/v1/warehouses/${id}` }),
  };

  stock = {
    levels: (params: { variant_id?: string } = {}) =>
      this.request<{ stock: VariantStock[] }>({ method: 'GET', path: `/api/v1/stock/levels${qs(params)}` }),
    movements: (params: { variant_id?: string } = {}) =>
      this.request<{ movements: StockMovement[] }>({ method: 'GET', path: `/api/v1/stock/movements${qs(params)}` }),
    reservations: () =>
      this.request<{ reservations: StockReservation[] }>({ method: 'GET', path: '/api/v1/stock/reservations' }),
    adjust: (input: { variantId: string; warehouseId: string; delta: number; reason: StockMovementReason; note?: string }) =>
      this.request<{ stock: VariantStock; movement: StockMovement }>({
        method: 'POST', path: '/api/v1/stock/adjust', body: input, idempotencyKey: this.genIdem(),
      }),
  };

  addresses = {
    list: (params: { customer_id?: string } = {}) =>
      this.request<{ addresses: CustomerAddress[] }>({ method: 'GET', path: `/api/v1/addresses${qs(params)}` }),
    create: (input: {
      customerId: string; label: string; contactName: string; contactPhone: string;
      email?: string; address: string; note?: string; postalCode?: string; areaId?: string;
      lat?: number; lng?: number; isDefault?: boolean;
    }) => this.request<{ address: CustomerAddress }>({
      method: 'POST', path: '/api/v1/addresses', body: input,
    }),
    update: (id: string, patch: {
      label?: string; contactName?: string; contactPhone?: string;
      email?: string; address?: string; note?: string; postalCode?: string;
      areaId?: string; lat?: number; lng?: number; isDefault?: boolean;
    }) => this.request<{ address: CustomerAddress }>({
      method: 'PATCH', path: `/api/v1/addresses/${id}`, body: patch,
    }),
    delete: (id: string) =>
      this.request<{ deleted: boolean }>({ method: 'DELETE', path: `/api/v1/addresses/${id}` }),
  };

  shipments = {
    list: (params: { status?: string } = {}) =>
      this.request<{ shipments: Shipment[] }>({ method: 'GET', path: `/api/v1/shipments${qs(params)}` }),
    get: (id: string) =>
      this.request<{ shipment: Shipment }>({ method: 'GET', path: `/api/v1/shipments/${id}` }),
    create: (input: {
      productId?: string; checkoutSessionId?: string; customerId?: string; customerEmail?: string;
      courierCode: string; courierServiceCode: string; courierType: string;
      price: number; insurance?: number; insured?: boolean;
      origin: Record<string, unknown>;
      destination: Record<string, unknown>;
      items: Array<Record<string, unknown>>;
      externalSource?: string; externalRef?: string;
    }) => this.request<{ shipment: Shipment }>({
      method: 'POST', path: '/api/v1/shipments', body: input, idempotencyKey: this.genIdem(),
    }),
    // F-004 / S-045 — confirm a Biteship draft → real order (driver
    // dispatched). Gated server-side by ShippingCredit balance (S-046).
    confirmPickup: (id: string) =>
      this.request<{ shipment: Shipment }>({
        method: 'POST', path: `/api/v1/shipments/${id}/confirm-pickup`, idempotencyKey: this.genIdem(),
      }),
    cancel: (id: string, reason?: string) =>
      this.request<{ shipment: Shipment }>({
        method: 'POST', path: `/api/v1/shipments/${id}/cancel`, body: { reason },
      }),
    // F-008 — live tracking detail (driver, status history, link to
    // Biteship's public map) for native rendering in merchant + buyer
    // portals. Pulls from Biteship /v1/trackings/:trackingId on each call.
    tracking: (id: string) =>
      this.request<{ tracking: BiteshipTrackingDetail; fetchedAt: string }>({
        method: 'GET', path: `/api/v1/shipments/${id}/tracking`,
      }),
  };

  // S-046: per-merchant prepaid shipping credit + ledger.
  shippingCredits = {
    get: () => this.request<{ accountId: string; balance: number; updatedAt: string }>({
      method: 'GET', path: '/api/v1/shipping-credits',
    }),
    listTransactions: (params: { limit?: number; cursor?: string } = {}) =>
      this.request<{
        data: Array<{
          id: string;
          kind: 'topup' | 'shipment_charge' | 'shipment_refund' | 'manual_adjustment';
          amount: number;
          balanceAfter: number;
          shipmentId: string | null;
          externalRef: string | null;
          memo: string | null;
          createdAt: string;
        }>;
        nextCursor: string | null;
      }>({ method: 'GET', path: `/api/v1/shipping-credits/transactions${qs(params)}` }),
    topUp: (input: { amount: number; externalRef?: string; memo?: string }) =>
      this.request<{ accountId: string; balance: number; updatedAt: string }>({
        method: 'POST', path: '/api/v1/shipping-credits/topup', body: input, idempotencyKey: this.genIdem(),
      }),
    adjust: (input: {
      amount: number;
      kind: 'manual_adjustment' | 'shipment_refund';
      shipmentId?: string;
      externalRef?: string;
      memo?: string;
    }) => this.request<{ accountId: string; balance: number; updatedAt: string }>({
      method: 'POST', path: '/api/v1/shipping-credits/adjust', body: input, idempotencyKey: this.genIdem(),
    }),
  };

  shipping = {
    couriers: () => this.request<unknown[]>({ method: 'GET', path: '/api/v1/shipping/couriers' }),
    origin: () => this.request<unknown>({ method: 'GET', path: '/api/v1/shipping/origin' }),
    setOrigin: (input: Record<string, unknown>) =>
      this.request<unknown>({ method: 'PATCH', path: '/api/v1/shipping/origin', body: input }),
    rates: (input: { destination: Record<string, unknown>; items: Array<Record<string, unknown>>; insurance?: boolean }) =>
      this.request<unknown>({ method: 'POST', path: '/api/v1/shipping/rates', body: input }),
  };

  licenses = {
    list: () => this.request<{ licenses: License[] }>({ method: 'GET', path: '/api/v1/licenses' }),
    issue: (input: {
      productId: string; customerId: string;
      maxActivations?: number; expiresAt?: string;
      externalSource?: string; externalRef?: string;
    }) =>
      this.request<{ license: License }>({
        method: 'POST', path: '/api/v1/licenses', body: input, idempotencyKey: this.genIdem(),
      }),
    revoke: (id: string) =>
      this.request<{ license: License }>({ method: 'POST', path: `/api/v1/licenses/${id}/revoke`, body: {} }),
    /** Public unauthenticated — buyers' apps call this with just the key. */
    activate: (input: { key: string; instanceId: string }) =>
      this.request<{ license: License; activation: LicenseActivation; alreadyActive: boolean }>({
        method: 'POST', path: '/api/v1/licenses/activate', body: input,
      }),
    /** Public unauthenticated — release a previously-activated instance. */
    deactivate: (input: { key: string; instanceId: string }) =>
      this.request<{ deactivated: boolean; alreadyDeactivated: boolean; activations: number }>({
        method: 'POST', path: '/api/v1/licenses/deactivate', body: input,
      }),
    /** Public unauthenticated — license-protected software pings this on launch. */
    validate: (params: { key: string; productId?: string }) =>
      this.request<{
        valid: boolean; key: string; status: string | null; productId: string | null;
        activations: number | null; maxActivations: number | null; expiresAt: string | null;
      }>({ method: 'GET', path: `/api/v1/licenses/validate${qs(params)}` }),
  };

  deliveries = {
    list: () => this.request<{ deliveries: Delivery[] }>({ method: 'GET', path: '/api/v1/deliveries' }),
    get: (id: string) => this.request<{ delivery: Delivery }>({ method: 'GET', path: `/api/v1/deliveries/${id}` }),
    create: (input: {
      productId: string; customerId: string; checkoutSessionId: string;
      maxDownloads?: number; expiresAt?: string;
      externalSource?: string; externalRef?: string;
    }) =>
      this.request<{ delivery: Delivery }>({
        method: 'POST', path: '/api/v1/deliveries', body: input, idempotencyKey: this.genIdem(),
      }),
  };

  // ─── API keys ────────────────────────────────────────────────
  apiKeys = {
    list: () => this.request<{ keys: Array<Record<string, unknown>> }>({
      method: 'GET', path: '/api/v1/api-keys',
    }),
    create: (input: { description?: string; scope?: string } = {}) => this.request<{ key: Record<string, unknown> }>({
      method: 'POST', path: '/api/v1/api-keys', body: input, idempotencyKey: this.genIdem(),
    }),
    revoke: (id: string) => this.request<{ revoked: boolean }>({
      method: 'POST', path: `/api/v1/api-keys/${id}/revoke`, body: {},
    }),
  };

  // ─── Audit log ───────────────────────────────────────────────
  auditLog = {
    list: (params: { limit?: number; cursor?: string; since?: string; eventType?: string } = {}) =>
      this.request<{ entries: Array<Record<string, unknown>>; nextCursor?: string }>({
        method: 'GET', path: `/api/v1/audit-log${qs(params)}`,
      }),
  };

  // ─── Billing (merchant subscription to Fulkruma) ────────────
  billing = {
    plans: () => this.request<Array<Record<string, unknown>>>({ method: 'GET', path: '/api/v1/billing/plans' }),
    currentPlan: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/billing/plan' }),
    subscription: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/billing/subscription' }),
    usage: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/billing/usage' }),
    invoices: (params: { limit?: number; cursor?: string } = {}) =>
      this.request<{ invoices: Array<Record<string, unknown>>; nextCursor?: string }>({
        method: 'GET', path: `/api/v1/billing/invoices${qs(params)}`,
      }),
    checkout: (input: { planId: string; successUrl?: string; cancelUrl?: string }) =>
      this.request<{ url: string; sessionId: string }>({
        method: 'POST', path: '/api/v1/billing/checkout', body: input,
      }),
    cancel: () => this.request<Record<string, unknown>>({
      method: 'POST', path: '/api/v1/billing/cancel', body: {},
    }),
  };

  // ─── Integrations status (Biteship, Plugipay, Storlaunch) ───
  integrations = {
    status: () => this.request<{
      huudis?: Record<string, unknown>;
      biteship?: Record<string, unknown>;
      plugipay?: Record<string, unknown>;
      storlaunch?: Record<string, unknown>;
    }>({ method: 'GET', path: '/api/v1/integrations/status' }),
  };

  // ─── Stats / overview ────────────────────────────────────────
  stats = {
    overview: () => this.request<{
      counters: Record<string, number>;
      recent: Record<string, unknown>;
    }>({ method: 'GET', path: '/api/v1/stats/overview' }),
  };

  // ─── Webhook endpoints + events ─────────────────────────────
  webhooks = {
    listEndpoints: () =>
      this.request<{ endpoints: Array<Record<string, unknown>> }>({
        method: 'GET', path: '/api/v1/webhooks/endpoints',
      }),
    createEndpoint: (input: { url: string; events?: string[]; description?: string }) =>
      this.request<{ endpoint: Record<string, unknown> }>({
        method: 'POST', path: '/api/v1/webhooks/endpoints', body: input, idempotencyKey: this.genIdem(),
      }),
    updateEndpoint: (id: string, patch: Partial<{ url: string; events: string[]; description: string; active: boolean }>) =>
      this.request<{ endpoint: Record<string, unknown> }>({
        method: 'PATCH', path: `/api/v1/webhooks/endpoints/${id}`, body: patch,
      }),
    deleteEndpoint: (id: string) =>
      this.request<{ deleted: boolean }>({ method: 'DELETE', path: `/api/v1/webhooks/endpoints/${id}` }),
    listEvents: (params: { limit?: number; cursor?: string; type?: string } = {}) =>
      this.request<{ events: Array<Record<string, unknown>>; nextCursor?: string }>({
        method: 'GET', path: `/api/v1/webhooks/events${qs(params)}`,
      }),
  };

  // ─── Platform-admin (Pattern 2 partner billing) ──────────────

  admin = {
    /** Idempotent — refuses to re-route a workspace already provisioned by a different partner. */
    provisionWorkspace: (input: {
      accountId: string;
      partner: 'storlaunch' | 'ripllo' | string;
      discountRate: number;
      brandName?: string;
      businessEmail?: string;
    }) => this.request<PartnerWorkspace>({
      method: 'POST', path: '/api/v1/admin/workspaces', body: input,
      idempotencyKey: `ws_${input.accountId}_${input.partner}`,
    }),
    getWorkspace: (accountId: string) =>
      this.request<PartnerWorkspace>({ method: 'GET', path: `/api/v1/admin/workspaces/${accountId}` }),
    partnerUsage: (params: { partner: string; from: string; to: string }) =>
      this.request<PartnerUsageSummary>({
        method: 'GET', path: `/api/v1/admin/partner/usage${qs(params)}`,
      }),
  };
}
