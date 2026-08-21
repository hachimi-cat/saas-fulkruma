import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { buildEvent } from '../lib/events.js';
import {
  cancelShipment,
  getAdapterForAccount,
  rebookShipment,
  resolveOrigin,
  ShipmentStateError,
  snapshotToDestination,
  snapshotToItems,
  snapshotToOrigin,
} from '../services/shipping-service.js';
import {
  applyTransaction as applyShippingCreditTxn,
  getBalance as getShippingCreditBalance,
  InsufficientShippingCreditError,
} from '../services/shipping-credit-service.js';
import {
  generateShipmentLabel,
  SHIPMENT_LABEL_SIZES,
  type ShipmentLabelOptions,
} from '../services/shipment-label-service.js';

const router = Router();
router.use(requireAuth);

// F-004: Shipments now book Biteship for real via the draft-order path.
//   POST /                       → POST /v1/draft_orders   (no charge, no driver)
//   POST /:id/confirm-pickup     → POST /v1/draft_orders/:id/confirm
//   POST /:id/cancel             → DELETE /v1/draft_orders/:id  (for unconfirmed)
//                                  DELETE /v1/orders/:id        (for confirmed)
//
// Two-step booking gives food / handmade / on-demand merchants the
// cook/pack window between buyer payment and courier dispatch.

const createSchema = z.object({
  productId: z.string().optional(),
  checkoutSessionId: z.string().optional(),
  customerId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  courierCode: z.string().min(1),
  courierServiceCode: z.string().min(1),
  courierType: z.string().min(1),
  price: z.number().int().nonnegative(),
  insurance: z.number().int().nonnegative().optional(),
  insured: z.boolean().optional(),
  origin: z.record(z.unknown()),
  destination: z.record(z.unknown()),
  items: z.array(z.record(z.unknown())).min(1),
  externalSource: z.string().min(1).max(50).optional(),
  externalRef: z.string().min(1).max(255).optional(),
});

router.get('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const status = req.query.status as string | undefined;
  const where = status ? { accountId, status: status as never } : { accountId };
  const rows = await prisma.shipment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(ok({ shipments: rows }, req.requestId ?? 'req_unknown'));
});

router.get('/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const shipment = await prisma.shipment.findFirst({
    where: { id: req.params.id, accountId },
    include: { events: { orderBy: { occurredAt: 'desc' } } },
  });
  if (!shipment) return res.status(404).json(err('NOT_FOUND', 'shipment not found', req.requestId ?? 'req_unknown'));
  res.json(ok({ shipment }, req.requestId ?? 'req_unknown'));
});

// F-008: live tracking detail (driver, status history, ETA) from Biteship.
// Reads biteshipTrackingId off the local shipment then calls
// /v1/trackings/:id which returns the richer data including instant-courier
// driver info. Used by storlaunch's order detail (merchant + buyer portal).
router.get('/:id/tracking', async (req, res) => {
  const reqId = req.requestId ?? 'req_unknown';
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const shipment = await prisma.shipment.findFirst({
    where: { id: req.params.id, accountId },
  });
  if (!shipment) return res.status(404).json(err('NOT_FOUND', 'shipment not found', reqId));
  if (!shipment.biteshipTrackingId) {
    return res.status(409).json(err('NO_TRACKING', 'shipment has no Biteship tracking id yet (likely unconfirmed draft)', reqId));
  }
  try {
    const adapter = await getAdapterForAccount(prisma, accountId);
    const tracking = await adapter.getTrackingById(shipment.biteshipTrackingId);
    return res.json(ok({ tracking, fetchedAt: new Date().toISOString() }, reqId));
  } catch (e) {
    return res.status(502).json(err('BITESHIP_TRACKING_FAILED', (e as Error).message, reqId));
  }
});

const queryBoolean = (defaultValue: boolean) => z.enum(['true', 'false'])
  .transform((value) => value === 'true')
  .default(defaultValue ? 'true' : 'false');

const labelQuerySchema = z.object({
  size: z.enum(SHIPMENT_LABEL_SIZES).default('thermal-100x150'),
  showSenderPhone: queryBoolean(true),
  showRecipientPhone: queryBoolean(true),
  maskRecipientName: queryBoolean(true),
  maskRecipientPhone: queryBoolean(true),
  showShippingCost: queryBoolean(true),
  showInsurance: queryBoolean(true),
  showItems: queryBoolean(true),
  showItemDescriptions: queryBoolean(true),
  showItemSkus: queryBoolean(true),
});

// Biteship deliberately has no shipping-label API. Generate the PDF from
// Fulkruma's authoritative shipment snapshot so every Forjio product prints
// the same document. If an older confirmed row missed the nested
// courier.waybill_id response shape, refresh once before declaring it unready.
router.get('/:id/label', async (req, res) => {
  const accountId = req.auth?.accountId;
  const reqId = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const parsed = labelQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, reqId));

  let shipment = await prisma.shipment.findFirst({ where: { id: req.params.id, accountId } });
  if (!shipment) return res.status(404).json(err('NOT_FOUND', 'shipment not found', reqId));

  if (!shipment.waybillId && shipment.biteshipOrderId) {
    try {
      const adapter = await getAdapterForAccount(prisma, accountId);
      const order = await adapter.getOrder(shipment.biteshipOrderId);
      const waybillId = order.waybill_id ?? order.courier?.waybill_id ?? null;
      if (waybillId) {
        shipment = await prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            waybillId,
            biteshipTrackingId: order.courier?.tracking_id ?? shipment.biteshipTrackingId,
            trackingUrl: order.tracking?.url ?? shipment.trackingUrl,
          },
        });
      }
    } catch (e) {
      console.warn(`[shipments/:id/label] unable to refresh Biteship order ${shipment.biteshipOrderId}:`, (e as Error).message);
    }
  }

  if (!shipment.waybillId) {
    return res.status(409).json(err('LABEL_NOT_READY', 'Label is available after the courier is booked and an AWB is issued', reqId));
  }

  const label = await generateShipmentLabel(shipment, parsed.data as ShipmentLabelOptions);
  return res.json(ok({ label }, reqId));
});

router.post('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const d = parsed.data;

  // Step 1 — book a Biteship draft order. No charge to the merchant
  // and no driver allocation; the parcel stays at origin until the
  // merchant explicitly confirms pickup. Falls back to a placeholder
  // id when no API key is configured (dev / fixtures) so the local
  // row still gets created.
  let draftOrderId: string | null = null;
  let draftCreateError: string | null = null;
  // F-004/S-045: Resolve origin server-side from the merchant's
  // BiteshipConfig when the caller passed an empty (or partial) origin.
  // Storlaunch's storefront has no business knowing the merchant's
  // pickup address — the canonical origin lives here, configured via
  // PATCH /shipping/origin. Inline origin still wins per-field when the
  // caller wants to override (e.g. multi-warehouse merchants later).
  const inboundOrigin = d.origin as Record<string, unknown>;
  let resolvedOriginPayload: Record<string, unknown> = inboundOrigin;
  const originLooksEmpty = !inboundOrigin
    || (
      !String(inboundOrigin.contactName ?? '').trim()
      && !String(inboundOrigin.contactPhone ?? '').trim()
      && !String(inboundOrigin.address ?? '').trim()
    );
  if (originLooksEmpty) {
    try {
      const merchantOrigin = await resolveOrigin(prisma, accountId);
      resolvedOriginPayload = {
        contactName: merchantOrigin.contactName,
        contactPhone: merchantOrigin.contactPhone,
        address: merchantOrigin.address,
        postalCode: merchantOrigin.postalCode,
        areaId: merchantOrigin.areaId,
        lat: merchantOrigin.lat,
        lng: merchantOrigin.lng,
        note: merchantOrigin.note,
      };
    } catch (e) {
      // Origin not configured — record the reason so the caller (and
      // the outbox event) can see why no draft was booked, but still
      // persist the local Shipment row so the merchant can retry once
      // they configure the origin via the dashboard.
      draftCreateError = `Origin not configured for account ${accountId}: ${(e as Error).message}`;
      console.error('[shipments] cannot resolve merchant origin:', draftCreateError);
    }
  }
  try {
    if (draftCreateError) {
      // Origin missing — skip the Biteship call but keep the local
      // Shipment row. draftCreateError already populated above.
      throw new Error('skip_biteship_call');
    }
    const adapter = await getAdapterForAccount(prisma, accountId);
    const draft = await adapter.createDraftOrder({
      referenceId: d.externalRef ?? `fulkruma-${Date.now()}`,
      origin: snapshotToOrigin(resolvedOriginPayload as Record<string, unknown>),
      destination: snapshotToDestination(d.destination as Record<string, unknown>),
      courierCompany: d.courierCode,
      courierType: d.courierServiceCode,
      courierInsurance: d.insured ? d.insurance : undefined,
      items: snapshotToItems(d.items as Array<Record<string, unknown>>),
    });
    draftOrderId = draft.id;
  } catch (e) {
    // Best-effort: still persist the local shipment so the merchant
    // can retry the booking via the confirm endpoint later. Log loud.
    // Preserve the upstream "origin not configured" reason when we
    // intentionally short-circuited.
    const msg = (e as Error).message;
    if (msg !== 'skip_biteship_call') {
      draftCreateError = msg;
      console.error('[shipments] Biteship draft order create failed:', draftCreateError);
    }
  }

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        accountId,
        productId: d.productId,
        checkoutSessionId: d.checkoutSessionId,
        customerId: d.customerId,
        customerEmail: d.customerEmail,
        biteshipDraftOrderId: draftOrderId,
        biteshipOrderId: null, // populated on confirm-pickup
        courierCode: d.courierCode,
        courierServiceCode: d.courierServiceCode,
        courierType: d.courierType,
        price: d.price,
        insurance: d.insurance ?? 0,
        insured: d.insured ?? false,
        originSnapshot: resolvedOriginPayload as Prisma.InputJsonValue,
        destinationSnapshot: d.destination as Prisma.InputJsonValue,
        items: d.items as Prisma.InputJsonValue,
        externalSource: d.externalSource ?? null,
        externalRef: d.externalRef ?? null,
      },
    });
    await tx.outboxEvent.create({
      data: buildEvent({
        type: 'fulkruma.shipment.created.v1',
        accountId,
        data: {
          shipmentId: created.id,
          checkoutSessionId: d.checkoutSessionId,
          courierCode: d.courierCode,
          status: created.status,
          biteshipDraftOrderId: draftOrderId,
          draftCreateError,
        },
      }),
    });
    return created;
  });
  res.status(201).json(ok({ shipment, draftCreateError }, req.requestId ?? 'req_unknown'));
});

// F-004: Merchant clicks "Book courier" once the parcel is actually
// ready. Confirms the Biteship draft, which creates the real order +
// dispatches the driver. Returns the updated shipment with the
// freshly-allocated biteshipOrderId, waybillId, etc.
router.post('/:id/confirm-pickup', async (req, res) => {
  const accountId = req.auth?.accountId;
  const reqId = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const shipment = await prisma.shipment.findFirst({
    where: { id: req.params.id, accountId },
  });
  if (!shipment) return res.status(404).json(err('NOT_FOUND', 'shipment not found', reqId));
  if (!shipment.biteshipDraftOrderId) {
    return res.status(409).json(err('NO_DRAFT', 'shipment has no Biteship draft to confirm (likely created before F-004 or draft create failed)', reqId));
  }
  if (shipment.biteshipOrderId) {
    return res.status(409).json(err('ALREADY_CONFIRMED', 'shipment is already booked with Biteship', reqId));
  }

  // S-046: gate dispatch on prepaid shipping credit. Check + reserve
  // BEFORE calling Biteship so a failed pre-check doesn't leak a real
  // draft confirmation. We re-check inside the post-Biteship txn so a
  // race between two confirm-pickup calls can't double-debit.
  const cost = shipment.price ?? 0;
  if (cost > 0) {
    const { balance } = await getShippingCreditBalance(accountId);
    if (balance < cost) {
      return res.status(402).json(err(
        'INSUFFICIENT_SHIPPING_CREDIT',
        `Shipping credit too low: this shipment costs Rp ${cost.toLocaleString('id-ID')}, balance is Rp ${balance.toLocaleString('id-ID')}. Top up to dispatch.`,
        reqId,
      ));
    }
  }

  let order;
  try {
    const adapter = await getAdapterForAccount(prisma, accountId);
    try {
      order = await adapter.confirmDraftOrder(shipment.biteshipDraftOrderId);
    } catch (firstErr) {
      // Draft created before a payload-shape bug fix (e.g. category=other
      // pre-fix, courier code rename) gets rejected by Biteship at confirm
      // time. Rebuild the draft inline from the stored snapshots so the
      // merchant doesn't have to recreate the whole order. One retry only.
      const msg = (firstErr as Error).message;
      const isValidationFailure = /is not a valid value|invalid|Please check Biteship/i.test(msg);
      if (!isValidationFailure) throw firstErr;
      console.warn(`[shipments] confirm failed on stale draft ${shipment.biteshipDraftOrderId} for ${shipment.id}: ${msg} — rebuilding draft from snapshots`);

      // Best-effort delete of the stale draft; ignore errors (Biteship
      // may have already GC'd it or never accepted it cleanly).
      try { await adapter.deleteDraftOrder(shipment.biteshipDraftOrderId); } catch { /* noop */ }

      const fresh = await adapter.createDraftOrder({
        referenceId: `${shipment.externalRef ?? shipment.id}-retry-${Date.now()}`,
        origin: snapshotToOrigin((shipment.originSnapshot as Record<string, unknown>) ?? {}),
        destination: snapshotToDestination((shipment.destinationSnapshot as Record<string, unknown>) ?? {}),
        courierCompany: shipment.courierCode,
        courierType: shipment.courierServiceCode,
        courierInsurance: shipment.insured ? shipment.insurance : undefined,
        items: snapshotToItems((shipment.items as Array<Record<string, unknown>>) ?? []),
      });

      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { biteshipDraftOrderId: fresh.id },
      });
      order = await adapter.confirmDraftOrder(fresh.id);
    }
  } catch (e) {
    return res.status(502).json(err('BITESHIP_CONFIRM_FAILED', (e as Error).message, reqId));
  }

  // S-046: debit + ledger entry + shipment update all in one txn.
  // If debit fails (balance drained by a concurrent confirm), Biteship
  // already created the order — surface a clear error and let ops
  // manually reconcile (rare race, < 1 in 1000).
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      if (cost > 0) {
        await applyShippingCreditTxn({
          accountId,
          amount: -cost,
          kind: 'shipment_charge',
          shipmentId: shipment.id,
          memo: `Pickup confirmed for shipment ${shipment.id} (${shipment.courierCode} ${shipment.courierServiceCode})`,
          tx,
        });
      }
      const row = await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          biteshipOrderId: order.id,
          biteshipTrackingId: order.courier?.tracking_id ?? null,
          waybillId: order.waybill_id ?? order.courier?.waybill_id ?? null,
          trackingUrl: order.tracking?.url ?? null,
          // Kept null for schema compatibility. Biteship has no label API;
          // GET /shipments/:id/label generates the PDF from this row.
          labelUrl: null,
          status: 'confirmed',
        },
      });
      await tx.shipmentEvent.create({
        data: {
          shipmentId: row.id,
          status: 'confirmed',
          note: 'Merchant confirmed pickup; Biteship order created.',
          occurredAt: new Date(),
          raw: order as never,
        },
      });
      await tx.outboxEvent.create({
        data: buildEvent({
          type: 'fulkruma.shipment.pickup_confirmed.v1',
          accountId,
          data: {
            shipmentId: row.id,
            biteshipOrderId: order.id,
            waybillId: order.waybill_id ?? order.courier?.waybill_id ?? null,
          },
        }),
      });
      return row;
    });
  } catch (e) {
    if (e instanceof InsufficientShippingCreditError) {
      return res.status(402).json(err(
        'INSUFFICIENT_SHIPPING_CREDIT',
        `Shipping credit was drained by another concurrent dispatch. Biteship order ${order.id} was created but not charged — contact support.`,
        reqId,
      ));
    }
    throw e;
  }

  res.json(ok({ shipment: updated }, reqId));
});

// Cancel a booking the courier hasn't collected yet, and give back the
// shipping credit confirm-pickup consumed. All of the behaviour lives in
// cancelShipment() so this route and the legacy /shipping/shipments/:id/
// cancel one can't drift — see the doc comment there.
router.post('/:id/cancel', async (req, res, next) => {
  const accountId = req.auth?.accountId;
  const reqId = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
    ? req.body.reason.trim()
    : 'Merchant cancelled';
  const shipment = await prisma.shipment.findFirst({
    where: { id: req.params.id, accountId },
    select: { id: true },
  });
  if (!shipment) return res.status(404).json(err('NOT_FOUND', 'shipment not found', reqId));

  try {
    const result = await cancelShipment(prisma, shipment.id, reason);
    return res.json(ok({
      shipment: result.shipment,
      refunded: result.refunded,
      courierError: result.courierError,
    }, reqId));
  } catch (e) {
    if (e instanceof ShipmentStateError) {
      return res.status(409).json(err('INVALID_STATE', e.message, reqId));
    }
    return next(e);
  }
});

// "Reorder" — mint a fresh shipment from a dead one's snapshots, so a
// no-show pickup or a courier rejection doesn't strand the parcel. The
// merchant may switch courier in the process; the replacement starts as
// an unconfirmed draft, so nothing is charged until they book it.
const rebookSchema = z.object({
  courierCode: z.string().min(1).optional(),
  courierServiceCode: z.string().min(1).optional(),
  courierType: z.string().min(1).optional(),
  price: z.number().int().nonnegative().optional(),
  insured: z.boolean().optional(),
  insurance: z.number().int().nonnegative().optional(),
});

router.post('/:id/rebook', async (req, res, next) => {
  const accountId = req.auth?.accountId;
  const reqId = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const parsed = rebookSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, reqId));

  const shipment = await prisma.shipment.findFirst({
    where: { id: req.params.id, accountId },
    select: { id: true },
  });
  if (!shipment) return res.status(404).json(err('NOT_FOUND', 'shipment not found', reqId));

  try {
    const { shipment: created, draftCreateError } = await rebookShipment(prisma, shipment.id, parsed.data);
    return res.status(201).json(ok({
      shipment: created,
      previousShipmentId: shipment.id,
      draftCreateError,
    }, reqId));
  } catch (e) {
    if (e instanceof ShipmentStateError) {
      return res.status(409).json(err('INVALID_STATE', e.message, reqId));
    }
    return next(e);
  }
});

export default router;
