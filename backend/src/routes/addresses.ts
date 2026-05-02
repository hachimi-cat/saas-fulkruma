import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  customerId: z.string().min(1),
  label: z.string().min(1).max(80),
  contactName: z.string().min(1).max(160),
  contactPhone: z.string().min(1).max(40),
  email: z.string().email().optional(),
  address: z.string().min(1),
  note: z.string().optional(),
  postalCode: z.string().optional(),
  areaId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

router.get('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const customerId = req.query.customer_id as string | undefined;
  const where = customerId ? { accountId, customerId } : { accountId };
  const rows = await prisma.customerAddress.findMany({
    where,
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
  });
  res.json(ok({ addresses: rows }, req.requestId ?? 'req_unknown'));
});

router.post('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const data = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId: data.customerId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.customerAddress.create({ data: { ...data, accountId } });
  });
  res.status(201).json(ok({ address: result }, req.requestId ?? 'req_unknown'));
});

router.delete('/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const row = await prisma.customerAddress.findFirst({ where: { id: req.params.id, accountId } });
  if (!row) return res.status(404).json(err('NOT_FOUND', 'address not found', req.requestId ?? 'req_unknown'));
  await prisma.customerAddress.delete({ where: { id: row.id } });
  res.json(ok({ deleted: true }, req.requestId ?? 'req_unknown'));
});

export default router;
