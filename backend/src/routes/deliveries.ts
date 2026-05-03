import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';
import { buildEvent } from '../lib/events.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  productId: z.string().min(1),
  customerId: z.string().min(1),
  checkoutSessionId: z.string().min(1),
  maxDownloads: z.number().int().positive().max(100).optional(),
  expiresAt: z.string().datetime().optional(),
  externalSource: z.string().min(1).max(50).optional(),
  externalRef: z.string().min(1).max(255).optional(),
});

router.get('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const rows = await prisma.delivery.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(ok({ deliveries: rows }, req.requestId ?? 'req_unknown'));
});

router.get('/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const row = await prisma.delivery.findFirst({
    where: { id: req.params.id, accountId },
  });
  if (!row) return res.status(404).json(err('NOT_FOUND', 'delivery not found', req.requestId ?? 'req_unknown'));
  res.json(ok({ delivery: row }, req.requestId ?? 'req_unknown'));
});

router.post('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const expires = parsed.data.expiresAt
    ? new Date(parsed.data.expiresAt)
    : new Date(Date.now() + 14 * 24 * 3600 * 1000);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.create({
        data: {
          accountId,
          productId: parsed.data.productId,
          customerId: parsed.data.customerId,
          checkoutSessionId: parsed.data.checkoutSessionId,
          maxDownloads: parsed.data.maxDownloads ?? 5,
          expiresAt: expires,
          externalSource: parsed.data.externalSource ?? null,
          externalRef: parsed.data.externalRef ?? null,
        },
      });
      await tx.outboxEvent.create({
        data: buildEvent({
          type: 'fulkruma.delivery.created.v1',
          accountId,
          data: {
            deliveryId: delivery.id,
            productId: delivery.productId,
            customerId: delivery.customerId,
            checkoutSessionId: delivery.checkoutSessionId,
          },
        }),
      });
      return delivery;
    });
    await writeAuditLog(prisma, {
      accountId, actorType: 'user', actorId: userId ?? null,
      action: 'delivery.created',
      targetType: 'Delivery', targetId: created.id,
      after: { productId: created.productId, customerId: created.customerId },
    });
    res.status(201).json(ok({ delivery: created }, req.requestId ?? 'req_unknown'));
  } catch (e) {
    if (typeof e === 'object' && e && 'code' in e && (e as { code: string }).code === 'P2002') {
      return res.status(409).json(err('DUPLICATE', 'delivery for that checkout already exists', req.requestId ?? 'req_unknown'));
    }
    throw e;
  }
});

export default router;
