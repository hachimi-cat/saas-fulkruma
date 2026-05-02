import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';
import { buildEvent } from '../lib/events.js';

const router = Router();
router.use(requireAuth);

const productSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['physical', 'digital', 'license']).default('physical'),
  weight: z.number().int().nonnegative().optional(),
  length: z.number().int().nonnegative().optional(),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  licenseEnabled: z.boolean().optional(),
  maxActivations: z.number().int().positive().optional(),
});

const variantSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1).max(160),
  priceCents: z.number().int().nonnegative().optional(),
  costCents: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  weight: z.number().int().nonnegative().optional(),
  isDefault: z.boolean().optional(),
});

router.get('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const includeArchived = req.query.archived === 'true';
  const where: Prisma.ProductWhereInput = { accountId };
  if (!includeArchived) where.archived = false;
  const rows = await prisma.product.findMany({
    where,
    include: { variants: { orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(ok({ products: rows }, req.requestId ?? 'req_unknown'));
});

router.get('/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const row = await prisma.product.findFirst({
    where: { id: req.params.id, accountId },
    include: { variants: { orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] } },
  });
  if (!row) return res.status(404).json(err('NOT_FOUND', 'product not found', req.requestId ?? 'req_unknown'));
  res.json(ok({ product: row }, req.requestId ?? 'req_unknown'));
});

router.post('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: { ...parsed.data, accountId },
    });
    // Auto-create a default variant so the product is immediately usable.
    await tx.productVariant.create({
      data: { productId: product.id, name: 'Default', isDefault: true },
    });
    await tx.outboxEvent.create({
      data: buildEvent({
        type: 'fulkruma.product.created.v1',
        accountId,
        data: { productId: product.id, name: product.name, type: product.type },
      }),
    });
    return product;
  });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'product.created',
    targetType: 'Product', targetId: created.id,
    after: { name: created.name, type: created.type },
  });
  const full = await prisma.product.findUnique({ where: { id: created.id }, include: { variants: true } });
  res.status(201).json(ok({ product: full }, req.requestId ?? 'req_unknown'));
});

router.patch('/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const product = await prisma.product.findFirst({ where: { id: req.params.id, accountId } });
  if (!product) return res.status(404).json(err('NOT_FOUND', 'product not found', req.requestId ?? 'req_unknown'));
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  const updated = await prisma.product.update({ where: { id: product.id }, data: parsed.data, include: { variants: true } });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'product.updated',
    targetType: 'Product', targetId: product.id,
    after: parsed.data,
  });
  res.json(ok({ product: updated }, req.requestId ?? 'req_unknown'));
});

router.delete('/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const product = await prisma.product.findFirst({ where: { id: req.params.id, accountId } });
  if (!product) return res.status(404).json(err('NOT_FOUND', 'product not found', req.requestId ?? 'req_unknown'));
  await prisma.product.update({ where: { id: product.id }, data: { archived: true } });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'product.archived',
    targetType: 'Product', targetId: product.id,
  });
  res.json(ok({ archived: true }, req.requestId ?? 'req_unknown'));
});

// ─── Variants ────────────────────────────────────────────────────────

router.post('/:id/variants', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const product = await prisma.product.findFirst({ where: { id: req.params.id, accountId } });
  if (!product) return res.status(404).json(err('NOT_FOUND', 'product not found', req.requestId ?? 'req_unknown'));
  const parsed = variantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  const result = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.productVariant.updateMany({
        where: { productId: product.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.productVariant.create({ data: { ...parsed.data, productId: product.id } });
  });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'variant.created',
    targetType: 'ProductVariant', targetId: result.id,
    after: { name: result.name, sku: result.sku },
  });
  res.status(201).json(ok({ variant: result }, req.requestId ?? 'req_unknown'));
});

router.patch('/:id/variants/:variantId', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const product = await prisma.product.findFirst({ where: { id: req.params.id, accountId } });
  if (!product) return res.status(404).json(err('NOT_FOUND', 'product not found', req.requestId ?? 'req_unknown'));
  const variant = await prisma.productVariant.findFirst({ where: { id: req.params.variantId, productId: product.id } });
  if (!variant) return res.status(404).json(err('NOT_FOUND', 'variant not found', req.requestId ?? 'req_unknown'));
  const parsed = variantSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.productVariant.updateMany({
        where: { productId: product.id, isDefault: true, NOT: { id: variant.id } },
        data: { isDefault: false },
      });
    }
    return tx.productVariant.update({ where: { id: variant.id }, data: parsed.data });
  });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'variant.updated',
    targetType: 'ProductVariant', targetId: variant.id,
    after: parsed.data,
  });
  res.json(ok({ variant: updated }, req.requestId ?? 'req_unknown'));
});

router.delete('/:id/variants/:variantId', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const product = await prisma.product.findFirst({ where: { id: req.params.id, accountId } });
  if (!product) return res.status(404).json(err('NOT_FOUND', 'product not found', req.requestId ?? 'req_unknown'));
  const variant = await prisma.productVariant.findFirst({ where: { id: req.params.variantId, productId: product.id } });
  if (!variant) return res.status(404).json(err('NOT_FOUND', 'variant not found', req.requestId ?? 'req_unknown'));
  await prisma.productVariant.update({ where: { id: variant.id }, data: { archived: true } });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'variant.archived',
    targetType: 'ProductVariant', targetId: variant.id,
  });
  res.json(ok({ archived: true }, req.requestId ?? 'req_unknown'));
});

export default router;
