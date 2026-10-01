import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { buildEvent } from '../lib/events.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  // The frontend WarehouseForm sends these as `value || null` when the
  // (optional) field is left blank, so the schema must accept null — not
  // just absent. Without .nullable() a name-only create 400s.
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  postal: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  phone: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
});

router.get('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const rows = await prisma.warehouse.findMany({
    where: { accountId, archived: false },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  res.json(ok({ warehouses: rows }, req.requestId ?? 'req_unknown'));
});

router.post('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  // First warehouse becomes default automatically.
  const existing = await prisma.warehouse.count({ where: { accountId } });
  const wh = await prisma.$transaction(async (tx) => {
    const row = await tx.warehouse.create({
      data: { ...parsed.data, accountId, isDefault: parsed.data.isDefault ?? existing === 0 },
    });
    // fulkruma.warehouse.created.v1 — in the same transaction as the create (ADR-0006).
    await tx.outboxEvent.create({
      data: buildEvent({
        type: 'fulkruma.warehouse.created.v1',
        accountId,
        data: {
          id: row.id,
          name: row.name,
          address: row.address,
          city: row.city,
          postal: row.postal,
          lat: row.lat,
          lng: row.lng,
          phone: row.phone,
          isDefault: row.isDefault,
          createdAt: row.createdAt.toISOString(),
        },
      }),
    });
    return row;
  });
  res.status(201).json(ok({ warehouse: wh }, req.requestId ?? 'req_unknown'));
});

router.patch('/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const wh = await prisma.warehouse.findFirst({ where: { id: req.params.id, accountId } });
  if (!wh) return res.status(404).json(err('NOT_FOUND', 'warehouse not found', req.requestId ?? 'req_unknown'));
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const updated = await prisma.warehouse.update({ where: { id: wh.id }, data: parsed.data });
  res.json(ok({ warehouse: updated }, req.requestId ?? 'req_unknown'));
});

router.delete('/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const wh = await prisma.warehouse.findFirst({ where: { id: req.params.id, accountId } });
  if (!wh) return res.status(404).json(err('NOT_FOUND', 'warehouse not found', req.requestId ?? 'req_unknown'));
  // Soft-archive — keeps stock movement history intact.
  await prisma.warehouse.update({ where: { id: wh.id }, data: { archived: true } });
  res.json(ok({ archived: true }, req.requestId ?? 'req_unknown'));
});

export default router;
