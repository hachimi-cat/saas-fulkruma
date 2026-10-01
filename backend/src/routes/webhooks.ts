import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';
import { assertSafeWebhookUrl, BlockedTargetError } from '../lib/webhook-target.js';
import { failPendingDeliveries, retryWebhookEvent } from '../services/webhook-delivery.js';

const router = Router();
router.use(requireAuth);

/** "*", an event type ("fulkruma.shipment.created.v1") or a prefix
 *  ending in "*" ("fulkruma.shipment.*"). Format-checked rather than
 *  catalog-checked, so a new event type needs no change here. */
const eventPattern = z
  .string()
  .min(1)
  .max(200)
  .refine((s) => s === '*' || /^fulkruma\.(\*|[a-z0-9_]+(\.[a-z0-9_]+)*(\.\*)?)$/.test(s), {
    message: 'must be "*", an event type like "fulkruma.shipment.created.v1", or a prefix like "fulkruma.shipment.*"',
  });

const createSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(eventPattern).min(1).max(50).default(['*']),
  description: z.string().max(500).optional(),
});

const updateSchema = z.object({
  url: z.string().url().max(2000).optional(),
  events: z.array(eventPattern).min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  active: z.boolean().optional(),
});

const listEventsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  endpointId: z.string().min(1).optional(),
});

/** The SSRF guard (lib/webhook-target.ts) as a 400 the caller can act on. */
async function urlRefusal(url: string): Promise<string | null> {
  try {
    await assertSafeWebhookUrl(url);
    return null;
  } catch (e) {
    if (e instanceof BlockedTargetError) return e.message;
    throw e;
  }
}

function sanitizeEndpoint<T extends { secret: string }>(row: T) {
  return { ...row, secret: undefined, secretPreview: row.secret ? `whsec_…${row.secret.slice(-4)}` : null };
}

const ATTEMPTS = { deliveryAttempts: { orderBy: { attemptNumber: 'asc' as const } } };

router.get('/endpoints', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const rows = await prisma.webhookEndpoint.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  });
  // Strip the secret on list — only show "secret exists".
  res.json(ok({ endpoints: rows.map(sanitizeEndpoint) }, req.requestId ?? 'req_unknown'));
});

/**
 * Register an endpoint. The response is the only time its signing secret
 * is returned. The URL must be https (in production) and must not point
 * at a private, loopback or link-local address. `events` takes "*",
 * event types ("fulkruma.shipment.created.v1") and prefixes
 * ("fulkruma.shipment.*").
 */
router.post('/endpoints', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  const rid = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid));
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, rid));
  }
  const refusal = await urlRefusal(parsed.data.url);
  if (refusal) return res.status(400).json(err('VALIDATION', `url: ${refusal}`, rid));
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
  res.status(201).json(ok({ endpoint: { ...created, secret: undefined }, secret }, rid));
});

/**
 * Update an endpoint. Setting `active: false` pauses it (its queued
 * deliveries become failed); `active: true` re-enables it — also after
 * Fulkruma switched it off for failing — and clears its failure streak.
 * A new `url` goes through the same checks as on register; the signing
 * secret stays the same.
 */
router.patch('/endpoints/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  const rid = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid));
  const wh = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, accountId } });
  if (!wh) return res.status(404).json(err('NOT_FOUND', 'endpoint not found', rid));
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, rid));
  if (parsed.data.url !== undefined && parsed.data.url !== wh.url) {
    const refusal = await urlRefusal(parsed.data.url);
    if (refusal) return res.status(400).json(err('VALIDATION', `url: ${refusal}`, rid));
  }
  const data: Prisma.WebhookEndpointUpdateInput = { ...parsed.data };
  if (parsed.data.active === true) {
    Object.assign(data, { consecutiveFailures: 0, failingSince: null, disabledAt: null, disabledReason: null });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.webhookEndpoint.update({ where: { id: wh.id }, data });
    if (parsed.data.active === false && wh.active) await failPendingDeliveries(tx, wh.id, 'endpoint is disabled');
    return row;
  });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'webhook.updated',
    targetType: 'WebhookEndpoint', targetId: wh.id,
    before: { url: wh.url, active: wh.active }, after: parsed.data,
  });
  res.json(ok({ endpoint: { ...updated, secret: undefined } }, rid));
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

/**
 * List webhook deliveries. Newest first: one row per event per endpoint,
 * with its status (pending, sent, failed), attempt count, next retry and
 * every attempt made (`deliveryAttempts`). Filter by `type`, `status` or
 * `endpointId`; page with `limit` (1-200, default 50) and the returned
 * `nextCursor`.
 */
router.get('/events', async (req, res) => {
  const accountId = req.auth?.accountId;
  const rid = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid));
  const parsed = listEventsQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, rid));
  const { limit, cursor, type, status, endpointId } = parsed.data;
  const where: Prisma.WebhookEventWhereInput = {
    accountId,
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(endpointId ? { endpointId } : {}),
  };
  // The cursor must be one of this account's rows; anything else starts over.
  const from = cursor ? await prisma.webhookEvent.findFirst({ where: { id: cursor, accountId }, select: { id: true } }) : null;
  const rows = await prisma.webhookEvent.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(from ? { cursor: { id: from.id }, skip: 1 } : {}),
    include: ATTEMPTS,
  });
  const events = rows.slice(0, limit);
  const nextCursor = rows.length > limit && events.length > 0 ? events[events.length - 1]!.id : null;
  res.json(ok({ events, nextCursor }, rid));
});

/**
 * Get a webhook delivery. Includes every attempt made at it.
 */
router.get('/events/:id', async (req, res) => {
  const accountId = req.auth?.accountId;
  const rid = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid));
  const event = await prisma.webhookEvent.findFirst({ where: { id: req.params.id, accountId }, include: ATTEMPTS });
  if (!event) return res.status(404).json(err('NOT_FOUND', 'webhook event not found', rid));
  res.json(ok({ event }, rid));
});

/**
 * Retry a webhook delivery. Queues one more attempt now at a failed
 * delivery (or sends a sent one again). It goes out within a few
 * seconds; read it back with GET /webhooks/events/:id. 409 when it is
 * already queued or its endpoint is disabled.
 */
router.post('/events/:id/retry', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  const rid = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', rid));
  const out = await retryWebhookEvent(accountId, String(req.params.id));
  if (!out.ok) {
    return res.status(out.code === 'NOT_FOUND' ? 404 : 409).json(err(out.code, out.message, rid));
  }
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'webhook.event_retried',
    targetType: 'WebhookEvent', targetId: out.event.id,
    metadata: { endpointId: out.event.endpointId, eventId: out.event.eventId, type: out.event.type },
  });
  res.status(202).json(ok({ event: out.event }, rid));
});

export default router;
