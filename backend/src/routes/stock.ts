import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { buildEvent } from '../lib/events.js';

const router = Router();
router.use(requireAuth);

const adjustSchema = z.object({
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  delta: z.number().int(),
  reason: z.enum([
    'manual_adjust',
    'initial_stock',
    'transfer_in',
    'transfer_out',
    'damaged',
    'returned_to_supplier',
    'refund_restock',
    'import',
  ]),
  note: z.string().optional(),
});

router.get('/levels', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const variantId = req.query.variant_id as string | undefined;
  const where = variantId
    ? { variantId, warehouse: { accountId } }
    : { warehouse: { accountId } };
  const rows = await prisma.variantStock.findMany({
    where,
    include: { warehouse: true },
    orderBy: [{ updatedAt: 'desc' }],
    take: 200,
  });
  res.json(ok({ stock: rows }, req.requestId ?? 'req_unknown'));
});

router.get('/reservations', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const rows = await prisma.stockReservation.findMany({
    where: { warehouse: { accountId } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(ok({ reservations: rows }, req.requestId ?? 'req_unknown'));
});

router.get('/movements', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const variantId = req.query.variant_id as string | undefined;
  const where = variantId
    ? { variantId, warehouse: { accountId } }
    : { warehouse: { accountId } };
  const rows = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(ok({ movements: rows }, req.requestId ?? 'req_unknown'));
});

router.post('/adjust', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const { variantId, warehouseId, delta, reason, note } = parsed.data;

  const wh = await prisma.warehouse.findFirst({ where: { id: warehouseId, accountId } });
  if (!wh) return res.status(404).json(err('NOT_FOUND', 'warehouse not found', req.requestId ?? 'req_unknown'));

  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.variantStock.upsert({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      update: { quantity: { increment: delta } },
      create: { variantId, warehouseId, quantity: Math.max(0, delta) },
    });
    if (stock.quantity < 0) {
      throw new Error('NEGATIVE_STOCK');
    }
    const movement = await tx.stockMovement.create({
      data: { variantId, warehouseId, delta, reason, note, createdBy: userId ?? null },
    });
    await tx.outboxEvent.create({
      data: buildEvent({
        type: 'fulkruma.stock.adjusted.v1',
        accountId,
        data: {
          variantId,
          warehouseId,
          delta,
          reason,
          quantityAfter: stock.quantity,
          movementId: movement.id,
        },
      }),
    });
    return { stock, movement };
  });
  res.json(ok(result, req.requestId ?? 'req_unknown'));
});

export default router;
