/**
 * Merchant webhooks — delivering outbox events to the endpoints a
 * merchant registered (POST /api/v1/webhooks/endpoints).
 *
 * Two steps, both run by the API process next to the outbox worker:
 *
 *  1. fan-out (`fanOutEvent`, called by services/outbox-worker.ts for
 *     every outbox event): one `WebhookEvent` row — status `pending`,
 *     due now — for each ACTIVE endpoint of the event's own account
 *     whose `events` match its type and that already existed when the
 *     event happened. Account-scoped: an event with no accountId goes
 *     to nobody, and one account's events never reach another's
 *     endpoints. Idempotent on (endpointId, eventId), so the outbox
 *     worker re-running it (it does, while a partner delivery is
 *     failing) never queues an event twice.
 *
 *  2. delivery (`deliverDueWebhooks`, polled by
 *     `startWebhookDeliveryWorker`): every pending row whose
 *     `nextRetryAt` has come is CLAIMED (a conditional update pushes
 *     `nextRetryAt` out by a lease, so two pollers never send the same
 *     row, and a crash mid-request just lets the lease run out), then
 *     POSTed with the endpoint's secret, and the outcome written: one
 *     `WebhookDeliveryAttempt` row per attempt, and the row itself moved
 *     to `sent`, rescheduled, or — after the last attempt — `failed`.
 *
 * The request (the Forjio family convention — Plugipay, Huudis,
 * Suppuo, Secronna sign the same way; the SDKs' verifyWebhook helpers
 * check exactly this):
 *
 *   POST <endpoint url>
 *   Content-Type: application/json
 *   Fulkruma-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>
 *   Fulkruma-Event-Id / Fulkruma-Event-Type / Fulkruma-Delivery-Id / Fulkruma-Delivery-Attempt
 *   body: { id, type, occurredAt, accountId, data, metadata }   (id = evt_…, the same on every attempt)
 *
 * Retries follow Huudis's schedule (services/webhooks.ts there): a
 * 2xx within 10 s is success; anything else — another status, a
 * redirect (never followed), a timeout, a refused connection, a target
 * the SSRF guard blocks — is a failed attempt, retried 1 min, 5 min,
 * 25 min, 2 h and 12 h later; when the 6th attempt fails the row is
 * `failed` and stays so until someone retries it
 * (POST /webhooks/events/:id/retry).
 *
 * An endpoint that keeps failing is switched off (`active: false`,
 * `disabledAt`, `disabledReason`) — the family's circuit breaker
 * (Plugipay / Storlaunch: 20 consecutive failures). Here it takes 20
 * failed attempts in a row AND a failure streak at least 24 h old, so
 * a short outage during a merchant's deploy, which can fail 20 attempts
 * in minutes when events are busy, never switches anyone off; the
 * retries ride that out. Its queued deliveries become `failed`;
 * re-enabling it (PATCH active: true) resets the streak.
 */
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { writeAuditLog } from '../lib/audit.js';
import { assertSafeWebhookUrl, guardedLookup } from '../lib/webhook-target.js';

export const SIGNATURE_HEADER = 'Fulkruma-Signature';

/** Delay before retry N (index 0 = after the 1st attempt fails). */
export const RETRY_DELAYS_MS: readonly number[] = [
  60 * 1000,
  5 * 60 * 1000,
  25 * 60 * 1000,
  2 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
];
/** The 1st attempt plus one per scheduled retry. */
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
/** How much of the receiver's response is kept for the delivery log. */
export const RESPONSE_BODY_CAP = 2048;

function timeoutMs(): number {
  return Math.max(1, Number(process.env.WEBHOOK_TIMEOUT_MS ?? 10_000));
}
function disableAfterFailures(): number {
  return Math.max(1, Number(process.env.WEBHOOK_DISABLE_AFTER_FAILURES ?? 20));
}
function disableAfterMs(): number {
  return Math.max(0, Number(process.env.WEBHOOK_DISABLE_AFTER_HOURS ?? 24)) * 60 * 60 * 1000;
}
function concurrency(): number {
  return Math.max(1, Number(process.env.WEBHOOK_DELIVERY_CONCURRENCY ?? 5));
}
function batchSize(): number {
  return Math.max(1, Number(process.env.WEBHOOK_DELIVERY_BATCH ?? 50));
}
/** A claimed row becomes due again this long after its request's timeout. */
const LEASE_GRACE_MS = 60_000;

// ── signing ─────────────────────────────────────────────────────────

/** `t=<unix>,v1=<hex>` over `${t}.${body}` — also what partner deliveries carry. */
export function signWebhookBody(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const v1 = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

// ── subscription matching ───────────────────────────────────────────

/** `*` matches every type, `fulkruma.shipment.*` every type with that
 *  prefix, anything else only the exact type. */
export function eventMatches(patterns: unknown, type: string): boolean {
  if (!Array.isArray(patterns)) return false;
  return patterns.some((p) => {
    if (typeof p !== 'string' || p.length === 0) return false;
    if (p === '*' || p === type) return true;
    return p.endsWith('*') && type.startsWith(p.slice(0, -1));
  });
}

// ── fan-out ─────────────────────────────────────────────────────────

export interface OutboxEventLike {
  id: string;
  type: string;
  accountId: string | null;
  occurredAt: Date;
  data: unknown;
  metadata?: unknown;
}

export interface WebhookEnvelope {
  id: string;
  type: string;
  occurredAt: string;
  accountId: string | null;
  data: unknown;
  metadata: unknown;
}

function envelopeOf(ev: OutboxEventLike): WebhookEnvelope {
  return {
    id: ev.id,
    type: ev.type,
    occurredAt: ev.occurredAt.toISOString(),
    accountId: ev.accountId,
    data: ev.data ?? null,
    metadata: ev.metadata ?? {},
  };
}

/** Queue `ev` for every matching endpoint of its account. Returns how
 *  many deliveries were newly queued. */
export async function fanOutEvent(ev: OutboxEventLike): Promise<number> {
  if (!ev.accountId) return 0;
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { accountId: ev.accountId, active: true, createdAt: { lte: ev.occurredAt } },
    select: { id: true, events: true },
  });
  const matching = endpoints.filter((e) => eventMatches(e.events, ev.type));
  if (matching.length === 0) return 0;
  const now = new Date();
  const payload = envelopeOf(ev) as unknown as Prisma.InputJsonValue;
  const created = await prisma.webhookEvent.createMany({
    data: matching.map((e) => ({
      accountId: ev.accountId!,
      endpointId: e.id,
      eventId: ev.id,
      type: ev.type,
      payload,
      status: 'pending' as const,
      nextRetryAt: now,
    })),
    skipDuplicates: true,
  });
  return created.count;
}

// ── HTTP ────────────────────────────────────────────────────────────

export interface AttemptResult {
  ok: boolean;
  status: number | null;
  body: string | null;
  error: string | null;
  durationMs: number;
}

/** POST without following redirects, through the guarded DNS lookup,
 *  with a hard deadline; keeps at most RESPONSE_BODY_CAP of the reply. */
function postJson(url: string, headers: Record<string, string>, body: string, deadlineMs: number): Promise<AttemptResult> {
  const started = performance.now();
  const target = new URL(url);
  const mod = target.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (r: Omit<AttemptResult, 'durationMs'>) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ ...r, durationMs: Math.round(performance.now() - started) });
    };
    const req = mod.request(
      target,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
        lookup: guardedLookup as never,
        agent: false,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const chunks: Buffer[] = [];
        let size = 0;
        const done = () => {
          const text = Buffer.concat(chunks).toString('utf8').slice(0, RESPONSE_BODY_CAP);
          const ok = status >= 200 && status < 300;
          const error = ok
            ? null
            : status >= 300 && status < 400
              ? `redirect not followed (HTTP ${status})`
              : `HTTP ${status}`;
          finish({ ok, status, body: text, error });
        };
        res.on('data', (c: Buffer) => {
          if (size >= RESPONSE_BODY_CAP) return;
          chunks.push(c);
          size += c.length;
          if (size >= RESPONSE_BODY_CAP) {
            done();
            res.destroy();
          }
        });
        res.on('end', done);
        res.on('error', (e) => finish({ ok: false, status, body: null, error: e.message }));
      },
    );
    timer = setTimeout(() => {
      finish({ ok: false, status: null, body: null, error: `timed out after ${deadlineMs}ms` });
      req.destroy();
    }, deadlineMs);
    req.on('error', (e) => finish({ ok: false, status: null, body: null, error: e.message || String(e) }));
    req.end(body);
  });
}

/** One signed attempt at `url`. The SSRF guard runs first; a blocked
 *  target is a failed attempt, never a request. */
export async function sendSignedWebhook(
  url: string,
  secret: string,
  body: string,
  meta: { eventId: string; type: string; deliveryId: string; attempt: number },
): Promise<AttemptResult> {
  try {
    await assertSafeWebhookUrl(url);
  } catch (e) {
    return { ok: false, status: null, body: null, error: (e as Error).message, durationMs: 0 };
  }
  return postJson(
    url,
    {
      'Content-Type': 'application/json',
      'User-Agent': 'Fulkruma-Webhooks/1.0',
      [SIGNATURE_HEADER]: signWebhookBody(secret, body),
      'Fulkruma-Event-Id': meta.eventId,
      'Fulkruma-Event-Type': meta.type,
      'Fulkruma-Delivery-Id': meta.deliveryId,
      'Fulkruma-Delivery-Attempt': String(meta.attempt),
    },
    body,
    timeoutMs(),
  );
}

// ── delivery ────────────────────────────────────────────────────────

/** The envelope as stored, in a stable key order (jsonb sorts keys). */
function storedEnvelope(payload: Prisma.JsonValue): WebhookEnvelope {
  const p = (payload ?? {}) as Record<string, unknown>;
  return {
    id: String(p.id ?? ''),
    type: String(p.type ?? ''),
    occurredAt: String(p.occurredAt ?? ''),
    accountId: (p.accountId as string | null) ?? null,
    data: p.data ?? null,
    metadata: p.metadata ?? {},
  };
}

/** Mark an endpoint's queued deliveries `failed` (it was switched off). */
export async function failPendingDeliveries(
  client: Prisma.TransactionClient | typeof prisma,
  endpointId: string,
  reason: string,
): Promise<number> {
  const r = await client.webhookEvent.updateMany({
    where: { endpointId, status: 'pending' },
    data: { status: 'failed', nextRetryAt: null, lastError: reason },
  });
  return r.count;
}

/**
 * Claim and attempt one due delivery. Returns false when another
 * poller had already claimed it (or it is no longer due).
 */
async function deliverOne(id: string, clock: () => Date): Promise<boolean> {
  const claimedAt = clock();
  const claim = await prisma.webhookEvent.updateMany({
    where: { id, status: 'pending', nextRetryAt: { lte: claimedAt } },
    data: { nextRetryAt: new Date(claimedAt.getTime() + timeoutMs() + LEASE_GRACE_MS) },
  });
  if (claim.count !== 1) return false;

  const row = await prisma.webhookEvent.findUnique({ where: { id }, include: { endpoint: true } });
  if (!row) return false;
  const endpoint = row.endpoint;
  if (!endpoint.active) {
    await prisma.webhookEvent.update({
      where: { id },
      data: { status: 'failed', nextRetryAt: null, lastError: 'endpoint is disabled' },
    });
    return true;
  }

  const attemptNumber = row.attempts + 1;
  const result = await sendSignedWebhook(endpoint.url, endpoint.secret, JSON.stringify(storedEnvelope(row.payload)), {
    eventId: row.eventId,
    type: row.type,
    deliveryId: row.id,
    attempt: attemptNumber,
  });
  const at = clock();

  if (result.ok) {
    await prisma.$transaction([
      prisma.webhookDeliveryAttempt.create({
        data: {
          webhookEventId: row.id, accountId: row.accountId, endpointId: endpoint.id, attemptNumber,
          status: 'succeeded', responseCode: result.status, durationMs: result.durationMs, attemptedAt: at,
        },
      }),
      prisma.webhookEvent.update({
        where: { id: row.id },
        data: {
          status: 'sent', attempts: attemptNumber, lastAttemptAt: at, nextRetryAt: null, deliveredAt: at,
          responseCode: result.status, responseBody: result.body, lastError: null, durationMs: result.durationMs,
        },
      }),
      prisma.webhookEndpoint.updateMany({
        where: { id: endpoint.id, OR: [{ consecutiveFailures: { gt: 0 } }, { failingSince: { not: null } }] },
        data: { consecutiveFailures: 0, failingSince: null },
      }),
    ]);
    return true;
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const ep = await tx.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { consecutiveFailures: { increment: 1 } },
    });
    const failingSince = ep.failingSince ?? at;
    if (!ep.failingSince) {
      await tx.webhookEndpoint.updateMany({ where: { id: ep.id, failingSince: null }, data: { failingSince: at } });
    }
    let disabledReason: string | null = null;
    if (
      ep.active
      && ep.consecutiveFailures >= disableAfterFailures()
      && at.getTime() - failingSince.getTime() >= disableAfterMs()
    ) {
      const reason = `${ep.consecutiveFailures} consecutive failed deliveries since ${failingSince.toISOString()}`;
      const off = await tx.webhookEndpoint.updateMany({
        where: { id: ep.id, active: true },
        data: { active: false, disabledAt: at, disabledReason: reason },
      });
      if (off.count === 1) disabledReason = reason;
    }

    const giveUp = attemptNumber >= MAX_ATTEMPTS || disabledReason !== null;
    const nextRetryAt = giveUp ? null : new Date(at.getTime() + RETRY_DELAYS_MS[attemptNumber - 1]!);
    await tx.webhookDeliveryAttempt.create({
      data: {
        webhookEventId: row.id, accountId: row.accountId, endpointId: endpoint.id, attemptNumber,
        status: 'failed', responseCode: result.status, durationMs: result.durationMs, error: result.error,
        nextRetryAt, attemptedAt: at,
      },
    });
    await tx.webhookEvent.update({
      where: { id: row.id },
      data: {
        status: giveUp ? 'failed' : 'pending', attempts: attemptNumber, lastAttemptAt: at, nextRetryAt,
        responseCode: result.status, responseBody: result.body, lastError: result.error, durationMs: result.durationMs,
      },
    });
    if (disabledReason) await failPendingDeliveries(tx, endpoint.id, `endpoint disabled: ${disabledReason}`);
    return { disabledReason, consecutiveFailures: ep.consecutiveFailures };
  });

  if (outcome.disabledReason) {
    console.warn(`[webhooks] endpoint ${endpoint.id} (account ${endpoint.accountId}) disabled: ${outcome.disabledReason}`);
    await writeAuditLog(prisma, {
      accountId: endpoint.accountId, actorType: 'system', actorId: null,
      action: 'webhook.auto_disabled',
      targetType: 'WebhookEndpoint', targetId: endpoint.id,
      before: { active: true }, after: { active: false, disabledReason: outcome.disabledReason },
    });
  }
  return true;
}

async function forEachLimited<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await fn(item);
    }
  });
  await Promise.all(lanes);
}

/**
 * Attempt every delivery that is due. `now` overrides the clock (tests
 * step through the retry schedule with it). Returns how many were
 * attempted (or failed for a disabled endpoint) by this call.
 */
export async function deliverDueWebhooks(opts: { now?: Date; limit?: number } = {}): Promise<number> {
  const clock = () => opts.now ?? new Date();
  const due = await prisma.webhookEvent.findMany({
    where: { status: 'pending', nextRetryAt: { lte: clock() } },
    orderBy: { nextRetryAt: 'asc' },
    take: opts.limit ?? batchSize(),
    select: { id: true },
  });
  let handled = 0;
  await forEachLimited(due, concurrency(), async ({ id }) => {
    try {
      if (await deliverOne(id, clock)) handled++;
    } catch (e) {
      console.error(`[webhooks] delivery ${id} errored`, e);
    }
  });
  return handled;
}

// ── manual retry ────────────────────────────────────────────────────

export type RetryOutcome =
  | { ok: true; event: Awaited<ReturnType<typeof prisma.webhookEvent.update>> }
  | { ok: false; code: 'NOT_FOUND' | 'ALREADY_QUEUED' | 'ENDPOINT_DISABLED'; message: string };

/** Queue one more attempt now — for a `failed` delivery, or to send a
 *  `sent` one again. If it fails, the remaining scheduled retries (if
 *  any are left out of MAX_ATTEMPTS) follow as usual. */
export async function retryWebhookEvent(accountId: string, id: string): Promise<RetryOutcome> {
  const row = await prisma.webhookEvent.findFirst({
    where: { id, accountId },
    include: { endpoint: { select: { active: true } } },
  });
  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'webhook event not found' };
  if (row.status === 'pending') {
    return { ok: false, code: 'ALREADY_QUEUED', message: 'this delivery is already queued' };
  }
  if (!row.endpoint.active) {
    return { ok: false, code: 'ENDPOINT_DISABLED', message: 'the endpoint is disabled; re-enable it first' };
  }
  const event = await prisma.webhookEvent.update({
    where: { id: row.id },
    data: { status: 'pending', nextRetryAt: new Date() },
  });
  return { ok: true, event };
}

// ── the poller ──────────────────────────────────────────────────────

const POLL_MS = Number(process.env.WEBHOOK_POLL_INTERVAL_MS ?? 1000);
let stopped = false;

export async function startWebhookDeliveryWorker(): Promise<void> {
  console.log(`[webhooks] delivery worker polling every ${POLL_MS}ms`);
  while (!stopped) {
    try {
      await deliverDueWebhooks();
    } catch (e) {
      console.error('[webhooks] delivery loop error', e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

export function stopWebhookDeliveryWorker(): void {
  stopped = true;
}
