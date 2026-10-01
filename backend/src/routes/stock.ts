import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
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

/**
 * fulkruma.stock.low.v1 — when this change takes a level from at or above the variant's
 * `lowStockThreshold` to below it. Only on that crossing: a level that is already low and
 * drops further emits nothing, and a level that recovers and falls again emits again. A
 * variant with no threshold (null) never emits. `variantId` is Fulkruma's own variant id or
 * a synced Storlaunch variant's id (its externalRef); either finds the threshold.
 */
async function emitLowStockIfCrossed(
  tx: Prisma.TransactionClient,
  s: { accountId: string; variantId: string; warehouseId: string; quantityBefore: number; quantityAfter: number; movementId: string },
): Promise<boolean> {
  if (s.quantityAfter >= s.quantityBefore) return false;
  const variants = await tx.productVariant.findMany({
    where: {
      product: { accountId: s.accountId },
      OR: [{ id: s.variantId }, { externalSource: 'storlaunch', externalRef: s.variantId }],
    },
    select: { id: true, productId: true, sku: true, name: true, lowStockThreshold: true },
  });
  const variant = variants.find((v) => v.id === s.variantId) ?? variants[0];
  const threshold = variant?.lowStockThreshold;
  if (variant == null || threshold == null) return false;
  if (!(s.quantityBefore >= threshold && s.quantityAfter < threshold)) return false;
  await tx.outboxEvent.create({
    data: buildEvent({
      type: 'fulkruma.stock.low.v1',
      accountId: s.accountId,
      data: {
        variantId: s.variantId,
        productVariantId: variant.id,
        productId: variant.productId,
        warehouseId: s.warehouseId,
        sku: variant.sku,
        name: variant.name,
        quantity: s.quantityAfter,
        threshold,
        movementId: s.movementId,
      },
    }),
  });
  return true;
}

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
    const had = await tx.variantStock.findUnique({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      select: { id: true },
    });
    const stock = await tx.variantStock.upsert({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      update: { quantity: { increment: delta } },
      create: { variantId, warehouseId, quantity: Math.max(0, delta) },
    });
    if (stock.quantity < 0) {
      throw new Error('NEGATIVE_STOCK');
    }
    // The level before this adjustment: the increment is atomic, so for a row that was
    // already there it is exactly the level minus delta; a new row started at 0.
    const quantityBefore = had || delta >= 0 ? stock.quantity - delta : 0;
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
    await emitLowStockIfCrossed(tx, {
      accountId, variantId, warehouseId, quantityBefore, quantityAfter: stock.quantity, movementId: movement.id,
    });
    return { stock, movement };
  });
  res.json(ok(result, req.requestId ?? 'req_unknown'));
});

export default router;
