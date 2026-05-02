import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const action = req.query.action as string | undefined;
  const targetType = req.query.target_type as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 100), 500);

  const where = {
    accountId,
    ...(action ? { action: { startsWith: action } } : {}),
    ...(targetType ? { targetType } : {}),
  };
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(ok({ entries: rows }, req.requestId ?? 'req_unknown'));
});

export default router;
