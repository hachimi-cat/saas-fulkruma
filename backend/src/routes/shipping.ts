import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';

const router = Router();
router.use(requireAuth);

const ALL_COURIERS = ['jne', 'sicepat', 'ide', 'jnt', 'anteraja', 'pos', 'lion', 'ninja'] as const;

const upsertSchema = z.object({
  apiKey: z.string().nullable().optional(),
  defaultOriginId: z.string().nullable().optional(),
  enabledCouriers: z.array(z.enum(ALL_COURIERS)).optional(),
  defaultCourier: z.enum(ALL_COURIERS).nullable().optional(),
  active: z.boolean().optional(),
});

router.get('/config', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const cfg = await prisma.biteshipConfig.findUnique({ where: { accountId } });
  // Strip the API key — only show "configured" + last 4 chars.
  const sanitized = cfg ? {
    accountId: cfg.accountId,
    apiKeyConfigured: Boolean(cfg.apiKey),
    apiKeyPreview: cfg.apiKey ? `…${cfg.apiKey.slice(-4)}` : null,
    defaultOriginId: cfg.defaultOriginId,
    enabledCouriers: cfg.enabledCouriers,
    defaultCourier: cfg.defaultCourier,
    active: cfg.active,
    createdAt: cfg.createdAt,
    updatedAt: cfg.updatedAt,
  } : null;
  res.json(ok({
    config: sanitized,
    couriers: ALL_COURIERS,
  }, req.requestId ?? 'req_unknown'));
});

router.put('/config', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));

  const before = await prisma.biteshipConfig.findUnique({ where: { accountId } });
  const data = {
    ...parsed.data,
    enabledCouriers: parsed.data.enabledCouriers ?? before?.enabledCouriers ?? ['jne', 'sicepat'],
  };
  const cfg = await prisma.biteshipConfig.upsert({
    where: { accountId },
    update: data,
    create: { accountId, ...data },
  });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'shipping.config_updated',
    targetType: 'BiteshipConfig', targetId: accountId,
    before: before ? { active: before.active, defaultCourier: before.defaultCourier, enabledCouriers: before.enabledCouriers } : undefined,
    after: { active: cfg.active, defaultCourier: cfg.defaultCourier, enabledCouriers: cfg.enabledCouriers },
  });
  res.json(ok({
    config: {
      accountId: cfg.accountId,
      apiKeyConfigured: Boolean(cfg.apiKey),
      apiKeyPreview: cfg.apiKey ? `…${cfg.apiKey.slice(-4)}` : null,
      defaultOriginId: cfg.defaultOriginId,
      enabledCouriers: cfg.enabledCouriers,
      defaultCourier: cfg.defaultCourier,
      active: cfg.active,
    },
  }, req.requestId ?? 'req_unknown'));
});

export default router;
