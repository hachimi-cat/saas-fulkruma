import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { buildEvent } from '../lib/events.js';

const router = Router();
router.use(requireAuth);

// Shipping is currently scaffolded: list, get, and a "create" stub that
// records the intended shipment in the local DB without round-tripping
// to Biteship yet. Biteship adapter lands in Phase F when the
// fulkruma module is consumed by Storlaunch.

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
  // Phase E stub: record the intended shipment with a placeholder
  // biteshipOrderId. Phase F adapter will replace this with a real
  // Biteship orders.create call before persisting.
  const placeholderBiteshipId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        accountId,
        productId: d.productId,
        checkoutSessionId: d.checkoutSessionId,
        customerId: d.customerId,
        customerEmail: d.customerEmail,
        biteshipOrderId: placeholderBiteshipId,
        courierCode: d.courierCode,
        courierServiceCode: d.courierServiceCode,
        courierType: d.courierType,
        price: d.price,
        insurance: d.insurance ?? 0,
        insured: d.insured ?? false,
        originSnapshot: d.origin as Prisma.InputJsonValue,
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
        },
      }),
    });
    return created;
  });
  res.status(201).json(ok({ shipment }, req.requestId ?? 'req_unknown'));
});

export default router;
