import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1).default(['*']),
  description: z.string().optional(),
});

router.get('/endpoints', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const rows = await prisma.webhookEndpoint.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  });
  // Strip the secret on list — only show "secret exists".
  const sanitized = rows.map((r) => ({
    ...r,
    secret: undefined,
    secretPreview: r.secret ? `whsec_…${r.secret.slice(-4)}` : null,
  }));
  res.json(ok({ endpoints: sanitized }, req.requestId ?? 'req_unknown'));
});

router.post('/endpoints', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const secret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;
  const created = await prisma.webhookEndpoint.create({
    data: { accountId, url: parsed.data.url, events: parsed.data.events, description: parsed.data.description, secret },
  });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'webhook.created',
    targetType: 'WebhookEndpoint', targetId: created.id,
    after: { url: created.url, events: parsed.data.events },
  });
  res.status(201).json(ok({ endpoint: { ...created, secret: undefined }, secret }, req.requestId ?? 'req_unknown'));
});

router.patch('/endpoints/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const wh = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, accountId } });
  if (!wh) return res.status(404).json(err('NOT_FOUND', 'endpoint not found', req.requestId ?? 'req_unknown'));
  const schema = createSchema.partial().extend({ active: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  const updated = await prisma.webhookEndpoint.update({ where: { id: wh.id }, data: parsed.data });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'webhook.updated',
    targetType: 'WebhookEndpoint', targetId: wh.id,
    before: { url: wh.url, active: wh.active }, after: parsed.data,
  });
  res.json(ok({ endpoint: { ...updated, secret: undefined } }, req.requestId ?? 'req_unknown'));
});

router.delete('/endpoints/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const wh = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, accountId } });
  if (!wh) return res.status(404).json(err('NOT_FOUND', 'endpoint not found', req.requestId ?? 'req_unknown'));
  await prisma.webhookEndpoint.delete({ where: { id: wh.id } });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'webhook.deleted',
    targetType: 'WebhookEndpoint', targetId: wh.id,
    before: { url: wh.url },
  });
  res.json(ok({ deleted: true }, req.requestId ?? 'req_unknown'));
});

router.get('/events', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const rows = await prisma.webhookEvent.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(ok({ events: rows }, req.requestId ?? 'req_unknown'));
});

export default router;
