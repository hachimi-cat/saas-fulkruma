import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

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

export default router;
