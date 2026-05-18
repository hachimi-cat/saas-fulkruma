import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { buildEvent } from '../lib/events.js';
import { getAdapterForAccount, resolveOrigin } from '../services/shipping-service.js';
import {
  applyTransaction as applyShippingCreditTxn,
  getBalance as getShippingCreditBalance,
  InsufficientShippingCreditError,
} from '../services/shipping-credit-service.js';

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
    const origin = resolvedOriginPayload as Record<string, unknown>;
    const destination = d.destination as Record<string, unknown>;
    const items = d.items as Array<Record<string, unknown>>;
    const draft = await adapter.createDraftOrder({
      referenceId: d.externalRef ?? `fulkruma-${Date.now()}`,
      origin: {
        contactName: String(origin.contactName ?? ''),
        contactPhone: String(origin.contactPhone ?? ''),
        address: String(origin.address ?? ''),
        postalCode: origin.postalCode != null ? String(origin.postalCode) : undefined,
        areaId: origin.areaId != null ? String(origin.areaId) : undefined,
        lat: typeof origin.lat === 'number' ? origin.lat : undefined,
        lng: typeof origin.lng === 'number' ? origin.lng : undefined,
        note: origin.note != null ? String(origin.note) : undefined,
      },
      destination: {
        contactName: String(destination.contactName ?? ''),
        contactPhone: String(destination.contactPhone ?? ''),
        email: destination.email != null ? String(destination.email) : undefined,
        address: String(destination.address ?? ''),
        postalCode: destination.postalCode != null ? String(destination.postalCode) : undefined,
        areaId: destination.areaId != null ? String(destination.areaId) : undefined,
        lat: typeof destination.lat === 'number' ? destination.lat : undefined,
        lng: typeof destination.lng === 'number' ? destination.lng : undefined,
        note: destination.note != null ? String(destination.note) : undefined,
      },
      courierCompany: d.courierCode,
      courierType: d.courierServiceCode,
      courierInsurance: d.insured ? d.insurance : undefined,
      items: items.map((it) => ({
        name: String(it.name ?? 'Item'),
        description: it.description != null ? String(it.description) : undefined,
        category: it.category != null ? String(it.category) : 'other',
        value: typeof it.value === 'number' ? it.value : 0,
        weight: typeof it.weight === 'number' ? Math.max(1, it.weight) : 1,
        quantity: typeof it.quantity === 'number' ? it.quantity : 1,
      })),
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
    order = await adapter.confirmDraftOrder(shipment.biteshipDraftOrderId);
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
          waybillId: order.waybill_id ?? null,
          trackingUrl: order.tracking?.url ?? null,
          labelUrl: order.label ?? null,
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
            waybillId: order.waybill_id ?? null,
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

router.post('/:id/cancel', async (req, res) => {
  const accountId = req.auth?.accountId;
  const reqId = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Merchant cancelled';
  const shipment = await prisma.shipment.findFirst({
    where: { id: req.params.id, accountId },
  });
  if (!shipment) return res.status(404).json(err('NOT_FOUND', 'shipment not found', reqId));

  const adapter = await getAdapterForAccount(prisma, accountId);
  try {
    // Confirmed shipments cancel via /v1/orders; unconfirmed drafts
    // cancel via /v1/draft_orders (no Biteship charge incurred).
    if (shipment.biteshipOrderId) {
      await adapter.cancelOrder(shipment.biteshipOrderId, reason);
    } else if (shipment.biteshipDraftOrderId) {
      await adapter.deleteDraftOrder(shipment.biteshipDraftOrderId);
    }
  } catch (e) {
    console.warn('[shipments/:id/cancel] biteship cancel failed; flipping local row anyway:', (e as Error).message);
  }

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: { status: 'cancelled', cancelReason: reason },
  });
  res.json(ok({ shipment: updated }, reqId));
});

export default router;
