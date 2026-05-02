import { Router } from 'express';
import { z } from 'zod';
import { ok, err } from '@forjio/sdk/http';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';
import { writeAuditLog } from '../lib/audit.js';
import {
  createBiteshipAdapter,
  getAdapterForAccount,
  quoteRates,
  cancelShipment,
  DEFAULT_COURIERS,
  isInstantCourier,
  type ShippingDestination,
  type ShippingItem,
} from '../services/shipping-service.js';
import { ensureBiteshipOriginLocation } from '../services/address-service.js';

const router = Router();

// Helper — pull requestId off Request without crashing in tests.
function rid(req: { requestId?: string }): string {
  return req.requestId ?? 'req_unknown';
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const originSchema = z.object({
  address: z.string().min(1).max(500),
  province: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  district: z.string().max(100).optional().nullable(),
  village: z.string().max(100).optional().nullable(),
  postal: z.string().max(20).optional().nullable(),
  areaId: z.string().max(100).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  contactName: z.string().min(1).max(100),
  contactPhone: z.string().min(1).max(30),
  couriers: z.array(z.string()).optional(),
});

const destinationSchema = z.object({
  contactName: z.string().min(1).max(100),
  contactPhone: z.string().min(1).max(30),
  email: z.string().email().optional(),
  address: z.string().min(1).max(500),
  note: z.string().max(500).optional(),
  postalCode: z.string().max(20).optional(),
  areaId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const itemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  value: z.number().int().min(0),
  weight: z.number().int().min(1),
  length: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  quantity: z.number().int().min(1),
  productId: z.string().optional(),
});

const rateQuoteSchema = z.object({
  destination: destinationSchema,
  items: z.array(itemSchema).min(1),
  insurance: z.boolean().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function originConfigured(cfg: {
  originAddress: string | null;
  contactName: string | null;
  contactPhone: string | null;
}): boolean {
  return Boolean(cfg.originAddress && cfg.contactName && cfg.contactPhone);
}

// ─── GET /shipping/origin ────────────────────────────────────────────────────
router.get('/origin', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.auth?.accountId;
    if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
    const cfg = await prisma.biteshipConfig.findUnique({ where: { accountId } });
    if (!cfg) {
      return res.json(ok({
        address: null, province: null, city: null, district: null, village: null,
        postal: null, areaId: null, lat: null, lng: null, note: null,
        contactName: null, contactPhone: null,
        couriers: [...DEFAULT_COURIERS], configured: false,
      }, rid(req)));
    }
    return res.json(ok({
      address: cfg.originAddress,
      province: cfg.originProvince,
      city: cfg.originCity,
      district: cfg.originDistrict,
      village: cfg.originVillage,
      postal: cfg.originPostal,
      areaId: cfg.originAreaId,
      lat: cfg.originLat,
      lng: cfg.originLng,
      note: cfg.originNote,
      contactName: cfg.contactName,
      contactPhone: cfg.contactPhone,
      couriers: (Array.isArray(cfg.enabledCouriers) && cfg.enabledCouriers.length > 0)
        ? (cfg.enabledCouriers as string[])
        : [...DEFAULT_COURIERS],
      configured: originConfigured(cfg),
    }, rid(req)));
  } catch (e) { next(e); }
});

// ─── PATCH /shipping/origin ──────────────────────────────────────────────────
router.patch('/origin', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.auth?.accountId;
    const userId = req.auth?.sub;
    if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
    const parsed = originSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(err('VALIDATION_ERROR', parsed.error.message, rid(req)));
    const body = parsed.data;

    // Validate couriers against the live Biteship catalog (cached 1h).
    // Biteship expands the list over time — hardcoding the whitelist causes
    // false-positive "Unknown courier" errors for newly-added services.
    if (body.couriers) {
      let instantCodes: Set<string> | null = null;
      try {
        const adapter = await getAdapterForAccount(prisma, accountId);
        const catalog = await adapter.listCouriers();
        const validCodes = new Set(catalog.map((c) => c.courier_code));
        const invalid = body.couriers.filter((c) => !validCodes.has(c));
        if (invalid.length > 0) {
          return res.status(400).json(err('VALIDATION_ERROR', `Unknown couriers: ${invalid.join(', ')}`, rid(req)));
        }
        // Build instant-code set: only couriers whose EVERY service row is
        // instant/same_day (e.g. gosend, grab). Mixed couriers like sicepat
        // — which offer both same_day AND standard — aren't blocked; the
        // same-day service just won't show up at rate-quote time without coords.
        const byCourier = new Map<string, string[]>();
        for (const row of catalog) {
          const list = byCourier.get(row.courier_code) ?? [];
          list.push(row.service_type);
          byCourier.set(row.courier_code, list);
        }
        instantCodes = new Set();
        for (const [code, types] of byCourier) {
          if (types.every((t) => t === 'instant' || t === 'same_day')) {
            instantCodes.add(code);
          }
        }
      } catch (e) {
        // If Biteship is down, fall back to the cached DEFAULT_COURIERS list.
        // Better to accept a possibly-stale save than block the merchant.
        console.error('[shipping] Courier validation fell back to DEFAULT_COURIERS:', e);
        const invalid = body.couriers.filter((c) => !DEFAULT_COURIERS.includes(c as (typeof DEFAULT_COURIERS)[number]));
        if (invalid.length > 0) {
          return res.status(400).json(err('VALIDATION_ERROR', `Unknown couriers: ${invalid.join(', ')}`, rid(req)));
        }
      }
      // Block instant couriers without coords (using live catalog if available,
      // else the bundled isInstantCourier helper).
      const hasInstant = instantCodes
        ? body.couriers.some((c) => instantCodes!.has(c))
        : body.couriers.some(isInstantCourier);
      if (hasInstant && (body.lat == null || body.lng == null)) {
        return res.status(400).json(err('VALIDATION_ERROR', 'Instant couriers require origin lat/lng', rid(req)));
      }
    }

    // If origin address/coords/contact changed, invalidate the Biteship mirror
    // — the new one will be recreated lazily on next order.
    const before = await prisma.biteshipConfig.findUnique({ where: { accountId } });
    const priorBiteshipId = before?.biteshipOriginLocationId ?? null;

    const updated = await prisma.biteshipConfig.upsert({
      where: { accountId },
      update: {
        originAddress: body.address,
        originProvince: body.province ?? null,
        originCity: body.city ?? null,
        originDistrict: body.district ?? null,
        originVillage: body.village ?? null,
        originPostal: body.postal ?? null,
        originAreaId: body.areaId ?? null,
        originLat: body.lat ?? null,
        originLng: body.lng ?? null,
        originNote: body.note ?? null,
        contactName: body.contactName,
        contactPhone: body.contactPhone,
        biteshipOriginLocationId: null, // Reset mirror — recreated on first use.
        ...(body.couriers ? { enabledCouriers: body.couriers } : {}),
      },
      create: {
        accountId,
        originAddress: body.address,
        originProvince: body.province ?? null,
        originCity: body.city ?? null,
        originDistrict: body.district ?? null,
        originVillage: body.village ?? null,
        originPostal: body.postal ?? null,
        originAreaId: body.areaId ?? null,
        originLat: body.lat ?? null,
        originLng: body.lng ?? null,
        originNote: body.note ?? null,
        contactName: body.contactName,
        contactPhone: body.contactPhone,
        enabledCouriers: body.couriers ?? [...DEFAULT_COURIERS],
      },
    });

    // Clean up stale Biteship Location (best-effort).
    if (priorBiteshipId) {
      const adapter = await getAdapterForAccount(prisma, accountId);
      adapter.deleteLocation(priorBiteshipId).catch((e) =>
        console.error('[shipping] Failed to clean up prior Biteship origin location:', e),
      );
    }

    // Eagerly create new Biteship Location mirror (fire-and-forget — no blocking).
    ensureBiteshipOriginLocation(prisma, accountId).catch((e) =>
      console.error('[shipping] Failed to mirror origin to Biteship:', e),
    );

    await writeAuditLog(prisma, {
      accountId,
      actorType: 'user',
      actorId: userId ?? null,
      action: 'shipping.origin_updated',
      targetType: 'BiteshipConfig',
      targetId: accountId,
      before: before ? {
        address: before.originAddress, city: before.originCity,
        contactName: before.contactName, contactPhone: before.contactPhone,
      } : undefined,
      after: { address: updated.originAddress, city: updated.originCity },
    });

    return res.json(ok({
      address: updated.originAddress,
      province: updated.originProvince,
      city: updated.originCity,
      district: updated.originDistrict,
      village: updated.originVillage,
      postal: updated.originPostal,
      areaId: updated.originAreaId,
      lat: updated.originLat,
      lng: updated.originLng,
      note: updated.originNote,
      contactName: updated.contactName,
      contactPhone: updated.contactPhone,
      couriers: updated.enabledCouriers,
      configured: true,
    }, rid(req)));
  } catch (e) { next(e); }
});

// ─── GET /shipping/couriers (public — needed for rates/settings pages) ──────
// In Fulkruma we still gate this behind requireAuth: the dashboard always
// has a session, and we want per-merchant API key resolution.
router.get('/couriers', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.auth?.accountId;
    const adapter = accountId
      ? await getAdapterForAccount(prisma, accountId)
      : createBiteshipAdapter();
    const couriers = await adapter.listCouriers();
    return res.json(ok(couriers, rid(req)));
  } catch (e) { next(e); }
});

// ─── GET /shipping/areas?q=xxx ───────────────────────────────────────────────
router.get('/areas', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.auth?.accountId;
    if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json(ok([], rid(req)));
    const adapter = await getAdapterForAccount(prisma, accountId);
    const areas = await adapter.searchAreas(q);
    return res.json(ok(areas, rid(req)));
  } catch (e) { next(e); }
});

// ─── POST /shipping/rates ───────────────────────────────────────────────────
router.post('/rates', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.auth?.accountId;
    if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
    const parsed = rateQuoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(err('VALIDATION_ERROR', parsed.error.message, rid(req)));
    const { destination, items, insurance } = parsed.data;

    const rates = await quoteRates(prisma, {
      accountId,
      destination: destination as ShippingDestination,
      items: items as ShippingItem[],
      insurance,
    });

    return res.json(ok({
      rates,
      count: rates.length,
      hasCoords: destination.lat != null && destination.lng != null,
    }, rid(req)));
  } catch (e) {
    if (e instanceof Error && e.message === 'Shipping origin not configured') {
      return res.status(400).json(err('NOT_CONFIGURED', 'Merchant has not configured shipping origin', rid(req)));
    }
    next(e);
  }
});

// ─── GET /shipping/shipments ─────────────────────────────────────────────────
router.get('/shipments', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.auth?.accountId;
    if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const where = {
      accountId,
      ...(status ? { status: status as never } : {}),
    };

    const [total, shipments] = await Promise.all([
      prisma.shipment.count({ where }),
      prisma.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    ]);

    const hasMore = shipments.length > limit;
    const page = hasMore ? shipments.slice(0, limit) : shipments;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return res.json({
      data: page,
      error: null,
      meta: {
        requestId: rid(req),
        timestamp: new Date().toISOString(),
        total,
        cursor: nextCursor,
        hasMore,
      },
    });
  } catch (e) { next(e); }
});

// ─── GET /shipping/shipments/:id ─────────────────────────────────────────────
router.get('/shipments/:id', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.auth?.accountId;
    if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
    const shipment = await prisma.shipment.findUnique({
      where: { id: String(req.params.id) },
      include: {
        events: { orderBy: { occurredAt: 'desc' } },
      },
    });
    if (!shipment || shipment.accountId !== accountId) {
      return res.status(404).json(err('NOT_FOUND', 'Shipment not found', rid(req)));
    }
    return res.json(ok(shipment, rid(req)));
  } catch (e) { next(e); }
});

// ─── POST /shipping/shipments/:id/cancel ─────────────────────────────────────
router.post('/shipments/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.auth?.accountId;
    if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Merchant cancelled';
    const shipment = await prisma.shipment.findUnique({ where: { id: String(req.params.id) } });
    if (!shipment || shipment.accountId !== accountId) {
      return res.status(404).json(err('NOT_FOUND', 'Shipment not found', rid(req)));
    }
    await cancelShipment(prisma, shipment.id, reason);
    return res.json(ok({ id: shipment.id, status: 'cancelled' }, rid(req)));
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Cannot cancel')) {
      return res.status(409).json(err('INVALID_STATE', e.message, rid(req)));
    }
    next(e);
  }
});

// ─── GET /shipping/shipments/:id/label ───────────────────────────────────────
router.get('/shipments/:id/label', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.auth?.accountId;
    if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
    const shipment = await prisma.shipment.findUnique({ where: { id: String(req.params.id) } });
    if (!shipment || shipment.accountId !== accountId) {
      return res.status(404).json(err('NOT_FOUND', 'Shipment not found', rid(req)));
    }
    if (!shipment.labelUrl) {
      const adapter = await getAdapterForAccount(prisma, accountId);
      const order = await adapter.getOrder(shipment.biteshipOrderId);
      if (order.label) {
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { labelUrl: order.label, waybillId: order.waybill_id ?? shipment.waybillId },
        });
        return res.json(ok({ url: order.label }, rid(req)));
      }
      return res.status(409).json(err('NOT_READY', 'Label not yet generated by courier', rid(req)));
    }
    return res.json(ok({ url: shipment.labelUrl }, rid(req)));
  } catch (e) { next(e); }
});

// ─── GET /shipping/track/:waybillId (public — gated by requireAuth in Fulkruma) ─
router.get('/track/:waybillId', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.auth?.accountId;
    if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
    const waybillId = String(req.params.waybillId ?? '');
    const courier = String(req.query.courier ?? '');

    const shipment = await prisma.shipment.findFirst({
      where: { waybillId, accountId },
      include: { events: { orderBy: { occurredAt: 'desc' } } },
    });

    const adapter = await getAdapterForAccount(prisma, accountId);
    let status: string;
    let history: Array<{ status: string; note?: string; updated_at: string; service_type?: string }>;
    let driver: { name?: string; phone?: string; photoUrl?: string; plate?: string } | null = null;
    let externalLink: string | null = null;

    if (shipment?.biteshipTrackingId) {
      const trk = await adapter.getTrackingById(shipment.biteshipTrackingId);
      status = trk.status;
      history = trk.history ?? [];
      driver = {
        name: trk.courier?.driver_name,
        phone: trk.courier?.driver_phone,
        photoUrl: trk.courier?.driver_photo_url,
        plate: trk.courier?.driver_plate_number,
      };
      externalLink = trk.link ?? null;
    } else {
      if (!courier) {
        return res.status(400).json(err('VALIDATION_ERROR', 'courier query param required when tracking_id unavailable', rid(req)));
      }
      const trk = await adapter.trackWaybill(waybillId, courier);
      status = trk.status;
      history = trk.history ?? [];
    }

    return res.json(ok({
      waybillId,
      courier: courier || shipment?.courierCode || '',
      status,
      history,
      driver,
      externalLink,
      shipment: shipment
        ? {
            id: shipment.id,
            status: shipment.status,
            courierCode: shipment.courierCode,
            courierServiceCode: shipment.courierServiceCode,
            createdAt: shipment.createdAt,
            events: (shipment as unknown as { events: unknown }).events,
          }
        : null,
    }, rid(req)));
  } catch (e) { next(e); }
});

// ─── BiteshipConfig CRUD (kept from the old shipping.ts) ────────────────────
// The Storlaunch port handles origin via PATCH /origin, but the Fulkruma
// dashboard also needs a way to set the per-merchant Biteship API key
// + active flag. Original /config endpoints kept under /config/*.

const ALL_COURIERS = [...DEFAULT_COURIERS] as readonly string[];

const configSchema = z.object({
  apiKey: z.string().nullable().optional(),
  defaultOriginId: z.string().nullable().optional(),
  enabledCouriers: z.array(z.string()).optional(),
  defaultCourier: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

router.get('/config', requireAuth, async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
  const cfg = await prisma.biteshipConfig.findUnique({ where: { accountId } });
  const sanitized = cfg ? {
    accountId: cfg.accountId,
    apiKeyConfigured: Boolean(cfg.apiKey),
    apiKeyPreview: cfg.apiKey ? `…${cfg.apiKey.slice(-4)}` : null,
    defaultOriginId: cfg.defaultOriginId,
    enabledCouriers: cfg.enabledCouriers,
    defaultCourier: cfg.defaultCourier,
    active: cfg.active,
    createdAt: cfg.createdAt,
    updatedAt: cfg.updatedAt,
  } : null;
  res.json(ok({ config: sanitized, couriers: ALL_COURIERS }, rid(req)));
});

router.put('/config', requireAuth, async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid(req)));
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, rid(req)));

  const before = await prisma.biteshipConfig.findUnique({ where: { accountId } });
  const data = {
    ...parsed.data,
    enabledCouriers: parsed.data.enabledCouriers ?? (before?.enabledCouriers as string[] | undefined) ?? [...DEFAULT_COURIERS],
  };
  const cfg = await prisma.biteshipConfig.upsert({
    where: { accountId },
    update: data,
    create: { accountId, ...data },
  });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'shipping.config_updated',
    targetType: 'BiteshipConfig', targetId: accountId,
    before: before ? { active: before.active, defaultCourier: before.defaultCourier, enabledCouriers: before.enabledCouriers } : undefined,
    after: { active: cfg.active, defaultCourier: cfg.defaultCourier, enabledCouriers: cfg.enabledCouriers },
  });
  res.json(ok({
    config: {
      accountId: cfg.accountId,
      apiKeyConfigured: Boolean(cfg.apiKey),
      apiKeyPreview: cfg.apiKey ? `…${cfg.apiKey.slice(-4)}` : null,
      defaultOriginId: cfg.defaultOriginId,
      enabledCouriers: cfg.enabledCouriers,
      defaultCourier: cfg.defaultCourier,
      active: cfg.active,
    },
  }, rid(req)));
});

export default router;
