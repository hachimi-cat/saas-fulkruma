import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

/*
 * Merchant webhooks, end to end against a real Postgres (CI's `test` job
 * migrates one; locally: DATABASE_URL=… npx prisma migrate deploy).
 *
 * A merchant registers an endpoint; an outbox event of its account goes
 * through the outbox worker (fan-out) and the delivery worker to a real
 * HTTP receiver on 127.0.0.1, signed so the Node SDK's own
 * verifyWebhook accepts it. Then: only subscribed types, never another
 * account's events, the retry schedule to give-up, the circuit breaker,
 * the SSRF guard at registration and at delivery, the delivery log the
 * API lists, and the partner (Storlaunch) delivery that predates all
 * of this.
 *
 * Only `requireAuth` is replaced (the account comes from a test header);
 * everything else — prisma, the workers, the routes — is the real code.
 */
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const accountId = req.header('x-test-account');
    if (accountId) req.auth = { accountId, sub: 'usr_test' } as never;
    next();
  },
  requestId: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.requestId = 'req_test';
    next();
  },
}));

const HAS_DB = Boolean(process.env.DATABASE_URL);

const { prisma } = await import('../lib/db.js');
const { buildEvent } = await import('../lib/events.js');
const { default: webhooksRouter } = await import('../routes/webhooks.js');
const { processOutboxBatch } = await import('../services/outbox-worker.js');
const {
  deliverDueWebhooks, fanOutEvent, eventMatches, signWebhookBody, MAX_ATTEMPTS, RETRY_DELAYS_MS,
  pruneOldDeliveries,
} = await import('../services/webhook-delivery.js');
const { __setWebhookResolver, isBlockedAddress } = await import('../lib/webhook-target.js');

// The Node SDK's verifier, loaded from source: the server's signature
// has to pass the helper merchants actually use. (Imported by path so
// tsc's rootDir stays src/.)
const sdkWebhooks = path.resolve(__dirname, '../../../sdk/node/src/webhooks.ts');
const { verifyWebhook } = (await import(/* @vite-ignore */ sdkWebhooks)) as {
  verifyWebhook: (o: { rawBody: string; signature: string | undefined; secret: string }) => {
    id: string; type: string; accountId: string | null; data: Record<string, unknown>;
  };
};

// ── a local receiver ────────────────────────────────────────────────
interface Received { path: string; headers: http.IncomingHttpHeaders; body: string }
const received: Received[] = [];
/** path → status to answer with (default 200). */
const answers = new Map<string, number>();
let receiver: http.Server;
let base = '';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/v1/webhooks', webhooksRouter);
  return a;
}

const run = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const accounts: string[] = [];
const outboxIds: string[] = [];
function account(tag: string) {
  const id = `acc_whtest_${run}_${tag}`;
  accounts.push(id);
  return id;
}

async function register(accountId: string, body: Record<string, unknown>) {
  const res = await request(app()).post('/api/v1/webhooks/endpoints').set('x-test-account', accountId).send(body);
  return res;
}

async function emit(accountId: string | null, type: string, data: Record<string, unknown> = {}) {
  const ev = await prisma.outboxEvent.create({ data: buildEvent({ type, accountId, data: data as never }) });
  outboxIds.push(ev.id);
  return ev;
}

function hits(p: string) {
  return received.filter((r) => r.path === p);
}

describe.skipIf(!HAS_DB)('merchant webhooks (real database)', () => {
  beforeAll(async () => {
    receiver = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const p = req.url ?? '/';
        received.push({ path: p, headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
        const status = answers.get(p) ?? 200;
        if (status >= 300 && status < 400) res.setHeader('Location', 'http://169.254.169.254/latest/meta-data/');
        res.statusCode = status;
        res.end(status === 200 ? 'ok' : 'nope');
      });
    });
    await new Promise<void>((r) => receiver.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    received.length = 0;
    answers.clear();
    process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS = 'true';
  });

  afterEach(async () => {
    __setWebhookResolver(null);
    delete process.env.WEBHOOK_DISABLE_AFTER_FAILURES;
    delete process.env.WEBHOOK_DISABLE_AFTER_HOURS;
    delete process.env.STORLAUNCH_WEBHOOK_URL;
    delete process.env.FULKRUMA_OUTBOX_SECRET;
    // Endpoints cascade to their deliveries and attempts.
    await prisma.webhookEndpoint.deleteMany({ where: { accountId: { in: accounts } } });
    await prisma.outboxEvent.updateMany({ where: { id: { in: outboxIds } }, data: { publishedAt: new Date() } });
  });

  afterAll(async () => {
    await prisma.webhookEndpoint.deleteMany({ where: { accountId: { in: accounts } } });
    await prisma.outboxEvent.deleteMany({ where: { id: { in: outboxIds } } });
    await prisma.auditLog.deleteMany({ where: { accountId: { in: accounts } } });
    delete process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS;
    await new Promise((r) => receiver.close(r));
    await prisma.$disconnect();
  });

  it('delivers an outbox event to a subscribed endpoint, signed so the SDK verifies it', async () => {
    const acc = account('deliver');
    const reg = await register(acc, { url: `${base}/hook/deliver`, events: ['fulkruma.stock.*'] });
    expect(reg.status).toBe(201);
    const secret = reg.body.data.secret as string;
    const endpointId = reg.body.data.endpoint.id as string;

    const ev = await emit(acc, 'fulkruma.stock.adjusted.v1', { variantId: 'var_1', delta: -2, note: 'café — 日本' });
    await processOutboxBatch();
    expect((await prisma.outboxEvent.findUnique({ where: { id: ev.id } }))!.publishedAt).not.toBeNull();

    expect(await deliverDueWebhooks()).toBeGreaterThanOrEqual(1);
    const [hit] = hits('/hook/deliver');
    expect(hit).toBeDefined();
    expect(hits('/hook/deliver')).toHaveLength(1);

    const sig = hit!.headers['fulkruma-signature'] as string;
    expect(sig).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    const event = verifyWebhook({ rawBody: hit!.body, signature: sig, secret });
    expect(event.id).toBe(ev.id);
    expect(event.type).toBe('fulkruma.stock.adjusted.v1');
    expect(event.accountId).toBe(acc);
    expect(event.data).toMatchObject({ variantId: 'var_1', delta: -2, note: 'café — 日本' });
    expect(hit!.headers['fulkruma-event-id']).toBe(ev.id);
    expect(hit!.headers['fulkruma-event-type']).toBe('fulkruma.stock.adjusted.v1');
    expect(hit!.headers['fulkruma-delivery-attempt']).toBe('1');
    expect(() => verifyWebhook({ rawBody: hit!.body, signature: sig, secret: 'whsec_wrong' })).toThrow();

    const row = await prisma.webhookEvent.findFirstOrThrow({ where: { endpointId }, include: { deliveryAttempts: true } });
    expect(row).toMatchObject({ status: 'sent', attempts: 1, responseCode: 200, responseBody: 'ok', eventId: ev.id, nextRetryAt: null });
    expect(row.deliveredAt).not.toBeNull();
    expect(row.deliveryAttempts).toHaveLength(1);
    expect(row.deliveryAttempts[0]).toMatchObject({ attemptNumber: 1, status: 'succeeded', responseCode: 200, error: null });
    expect(row.deliveryAttempts[0]!.durationMs).toBeGreaterThanOrEqual(0);

    // Handled again (as when a partner delivery failed): nothing is queued twice.
    await fanOutEvent(ev);
    expect(await prisma.webhookEvent.count({ where: { endpointId } })).toBe(1);
    expect(await deliverDueWebhooks()).toBe(0);
  });

  it('signs exactly like the SDK helpers expect (shared test vector)', () => {
    const body = '{"id":"evt_01JTESTVECTOR0000000000000","type":"fulkruma.shipment.created.v1","occurredAt":"2026-01-01T00:00:00.000Z","accountId":"acc_test","data":{"shipmentId":"shp_1","note":"café — 日本"},"metadata":{}}';
    expect(signWebhookBody('whsec_fulkruma_test_vector_0001', body, 1767225600))
      .toBe('t=1767225600,v1=812b74713b8424ca6d154b60ee47541f37a0635d82f5ed55e83d949576e73fa1');
  });

  it('queues only the event types an endpoint subscribed to', async () => {
    const acc = account('subs');
    const licenses = (await register(acc, { url: `${base}/hook/licenses`, events: ['fulkruma.license.issued.v1'] })).body.data.endpoint.id;
    const shipments = (await register(acc, { url: `${base}/hook/shipments`, events: ['fulkruma.shipment.*'] })).body.data.endpoint.id;
    const everything = (await register(acc, { url: `${base}/hook/all`, events: ['*'] })).body.data.endpoint.id;
    const paused = (await register(acc, { url: `${base}/hook/paused`, events: ['*'] })).body.data.endpoint.id;
    await request(app()).patch(`/api/v1/webhooks/endpoints/${paused}`).set('x-test-account', acc).send({ active: false }).expect(200);

    for (const type of ['fulkruma.stock.adjusted.v1', 'fulkruma.license.issued.v1', 'fulkruma.license.revoked.v1', 'fulkruma.shipment.created.v1', 'fulkruma.shipment.status_updated.v1']) {
      await fanOutEvent(await emit(acc, type));
    }
    const typesFor = async (endpointId: string) =>
      (await prisma.webhookEvent.findMany({ where: { endpointId }, select: { type: true } })).map((r) => r.type).sort();
    expect(await typesFor(licenses)).toEqual(['fulkruma.license.issued.v1']);
    expect(await typesFor(shipments)).toEqual(['fulkruma.shipment.created.v1', 'fulkruma.shipment.status_updated.v1']);
    expect(await typesFor(everything)).toHaveLength(5);
    expect(await typesFor(paused)).toEqual([]);

    await deliverDueWebhooks();
    expect(hits('/hook/licenses').map((h) => h.headers['fulkruma-event-type'])).toEqual(['fulkruma.license.issued.v1']);
    expect(hits('/hook/shipments')).toHaveLength(2);
    expect(hits('/hook/paused')).toHaveLength(0);

    // An endpoint registered after an event happened does not receive it.
    const old = await emit(acc, 'fulkruma.license.issued.v1');
    const late = (await register(acc, { url: `${base}/hook/late`, events: ['*'] })).body.data.endpoint.id;
    await prisma.outboxEvent.update({ where: { id: old.id }, data: { occurredAt: new Date(Date.now() - 60_000) } });
    await fanOutEvent({ ...old, occurredAt: new Date(Date.now() - 60_000) });
    expect(await typesFor(late)).toEqual([]);

    expect(eventMatches(['fulkruma.shipment.*'], 'fulkruma.shipments_x.v1')).toBe(false);
    expect(eventMatches(['fulkruma.*'], 'fulkruma.delivery.updated.v1')).toBe(true);
    expect(eventMatches('*', 'fulkruma.delivery.updated.v1')).toBe(false);
  });

  it('never delivers one merchant\'s events to another merchant', async () => {
    const a = account('iso_a');
    const b = account('iso_b');
    const epA = (await register(a, { url: `${base}/hook/a`, events: ['*'] })).body.data.endpoint.id;
    const epB = (await register(b, { url: `${base}/hook/b`, events: ['*'] })).body.data.endpoint.id;

    const evA = await emit(a, 'fulkruma.license.issued.v1', { licenseId: 'lic_a' });
    await emit(null, 'fulkruma.license.issued.v1', { licenseId: 'platform' });
    await processOutboxBatch();
    await deliverDueWebhooks();

    expect(await prisma.webhookEvent.count({ where: { endpointId: epB } })).toBe(0);
    expect(await prisma.webhookEvent.count({ where: { endpointId: epA } })).toBe(1);
    expect(hits('/hook/b')).toHaveLength(0);
    expect(hits('/hook/a').map((h) => JSON.parse(h.body).id)).toEqual([evA.id]);

    // …nor shows them in its delivery log, nor lets it read or retry them.
    const listB = await request(app()).get('/api/v1/webhooks/events').set('x-test-account', b);
    expect(listB.body.data.events).toEqual([]);
    const rowA = await prisma.webhookEvent.findFirstOrThrow({ where: { endpointId: epA } });
    await request(app()).get(`/api/v1/webhooks/events/${rowA.id}`).set('x-test-account', b).expect(404);
    await request(app()).post(`/api/v1/webhooks/events/${rowA.id}/retry`).set('x-test-account', b).expect(404);
    const pageWithForeignCursor = await request(app()).get(`/api/v1/webhooks/events?cursor=${rowA.id}`).set('x-test-account', b);
    expect(pageWithForeignCursor.body.data.events).toEqual([]);
  });

  it('retries a failing delivery on the backoff schedule, then gives up; a manual retry sends it again', async () => {
    const acc = account('retry');
    const endpointId = (await register(acc, { url: `${base}/hook/flaky`, events: ['*'] })).body.data.endpoint.id;
    answers.set('/hook/flaky', 503);
    await fanOutEvent(await emit(acc, 'fulkruma.delivery.created.v1', { deliveryId: 'dlv_1' }));

    let now = new Date();
    expect(await deliverDueWebhooks({ now })).toBe(1);
    let row = await prisma.webhookEvent.findFirstOrThrow({ where: { endpointId } });
    expect(row).toMatchObject({ status: 'pending', attempts: 1, responseCode: 503, lastError: 'HTTP 503' });
    expect(row.nextRetryAt!.getTime() - row.lastAttemptAt!.getTime()).toBe(RETRY_DELAYS_MS[0]);

    // Not before it is due.
    expect(await deliverDueWebhooks({ now: new Date(now.getTime() + RETRY_DELAYS_MS[0]! - 1000) })).toBe(0);

    for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt++) {
      now = row.nextRetryAt!;
      expect(await deliverDueWebhooks({ now })).toBe(1);
      row = await prisma.webhookEvent.findFirstOrThrow({ where: { endpointId } });
      expect(row.attempts).toBe(attempt);
      if (attempt < MAX_ATTEMPTS) {
        expect(row.status).toBe('pending');
        expect(row.nextRetryAt!.getTime() - now.getTime()).toBe(RETRY_DELAYS_MS[attempt - 1]);
      }
    }
    expect(row).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS, nextRetryAt: null, lastError: 'HTTP 503' });
    expect(await deliverDueWebhooks({ now: new Date(now.getTime() + 7 * 24 * 3600_000) })).toBe(0);

    const tries = hits('/hook/flaky');
    expect(tries).toHaveLength(MAX_ATTEMPTS);
    expect(new Set(tries.map((t) => t.headers['fulkruma-event-id'])).size).toBe(1);
    expect(tries.map((t) => t.headers['fulkruma-delivery-attempt'])).toEqual(['1', '2', '3', '4', '5', '6']);

    // listEvents shows every attempt.
    const list = await request(app()).get(`/api/v1/webhooks/events?endpointId=${endpointId}&status=failed`).set('x-test-account', acc);
    expect(list.status).toBe(200);
    const [listed] = list.body.data.events;
    expect(listed.id).toBe(row.id);
    expect(listed.deliveryAttempts.map((a: { attemptNumber: number }) => a.attemptNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(listed.deliveryAttempts.every((a: { status: string; responseCode: number }) => a.status === 'failed' && a.responseCode === 503)).toBe(true);
    expect(listed.deliveryAttempts[0].nextRetryAt).not.toBeNull();
    expect(listed.deliveryAttempts[5].nextRetryAt).toBeNull();

    // Fixed on the merchant's side: retry by hand.
    answers.set('/hook/flaky', 200);
    const retried = await request(app()).post(`/api/v1/webhooks/events/${row.id}/retry`).set('x-test-account', acc);
    expect(retried.status).toBe(202);
    expect(retried.body.data.event.status).toBe('pending');
    await request(app()).post(`/api/v1/webhooks/events/${row.id}/retry`).set('x-test-account', acc).expect(409);
    expect(await deliverDueWebhooks()).toBe(1);
    const one = await request(app()).get(`/api/v1/webhooks/events/${row.id}`).set('x-test-account', acc);
    expect(one.body.data.event).toMatchObject({ status: 'sent', attempts: MAX_ATTEMPTS + 1, responseCode: 200 });
    expect(one.body.data.event.deliveryAttempts.at(-1)).toMatchObject({ attemptNumber: MAX_ATTEMPTS + 1, status: 'succeeded' });
    const ep = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpointId } });
    expect(ep).toMatchObject({ consecutiveFailures: 0, failingSince: null, active: true });
  });

  it('records a timeout, a redirect and a refused connection as failed attempts', async () => {
    const acc = account('modes');
    answers.set('/hook/redirect', 302);
    const redirect = (await register(acc, { url: `${base}/hook/redirect`, events: ['*'] })).body.data.endpoint.id;
    // A port nothing listens on.
    const closed = http.createServer();
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', r));
    const deadPort = (closed.address() as AddressInfo).port;
    await new Promise((r) => closed.close(r));
    const refused = (await register(acc, { url: `http://127.0.0.1:${deadPort}/x`, events: ['*'] })).body.data.endpoint.id;
    const silent = http.createServer(() => { /* never answers */ });
    await new Promise<void>((r) => silent.listen(0, '127.0.0.1', r));
    const slow = (await register(acc, { url: `http://127.0.0.1:${(silent.address() as AddressInfo).port}/x`, events: ['*'] })).body.data.endpoint.id;

    process.env.WEBHOOK_TIMEOUT_MS = '300';
    try {
      await fanOutEvent(await emit(acc, 'fulkruma.product.created.v1'));
      await deliverDueWebhooks();
    } finally {
      delete process.env.WEBHOOK_TIMEOUT_MS;
      silent.closeAllConnections();
      await new Promise((r) => silent.close(r));
    }
    const lastError = async (endpointId: string) => (await prisma.webhookEvent.findFirstOrThrow({ where: { endpointId } }));
    expect(await lastError(redirect)).toMatchObject({ status: 'pending', responseCode: 302, lastError: 'redirect not followed (HTTP 302)' });
    expect((await lastError(refused)).lastError).toMatch(/ECONNREFUSED/);
    expect(await lastError(slow)).toMatchObject({ responseCode: null, lastError: 'timed out after 300ms' });
    // The redirect target (cloud metadata) was never requested.
    expect(received.every((r) => r.path === '/hook/redirect')).toBe(true);
  });

  it('switches off an endpoint that keeps failing, and re-enabling it clears the streak', async () => {
    process.env.WEBHOOK_DISABLE_AFTER_FAILURES = '3';
    process.env.WEBHOOK_DISABLE_AFTER_HOURS = '1';
    const acc = account('breaker');
    const endpointId = (await register(acc, { url: `${base}/hook/down`, events: ['*'] })).body.data.endpoint.id;
    answers.set('/hook/down', 500);
    for (let i = 0; i < 3; i++) await fanOutEvent(await emit(acc, 'fulkruma.stock.adjusted.v1', { i }));

    const t0 = new Date();
    expect(await deliverDueWebhooks({ now: t0 })).toBe(3);
    let ep = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpointId } });
    // Three failures in a row, but the streak is minutes old: a deploy blip, not dead.
    expect(ep).toMatchObject({ active: true, consecutiveFailures: 3, disabledAt: null });
    expect(ep.failingSince).not.toBeNull();

    // Two hours on, still failing: the next failure switches it off.
    expect(await deliverDueWebhooks({ now: new Date(t0.getTime() + 2 * 3600_000), limit: 1 })).toBe(1);
    ep = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpointId } });
    expect(ep.active).toBe(false);
    expect(ep.disabledAt).not.toBeNull();
    expect(ep.disabledReason).toMatch(/^4 consecutive failed deliveries since /);
    const rows = await prisma.webhookEvent.findMany({ where: { endpointId } });
    expect(rows.every((r) => r.status === 'failed' && r.nextRetryAt === null)).toBe(true);
    expect(rows.filter((r) => r.lastError?.startsWith('endpoint disabled: '))).toHaveLength(2);
    expect(await prisma.auditLog.count({ where: { accountId: acc, action: 'webhook.auto_disabled', targetId: endpointId } })).toBe(1);

    // Nothing more is queued for it while it is off; a retry is refused.
    await fanOutEvent(await emit(acc, 'fulkruma.stock.adjusted.v1'));
    expect(await prisma.webhookEvent.count({ where: { endpointId } })).toBe(3);
    await request(app()).post(`/api/v1/webhooks/events/${rows[0]!.id}/retry`).set('x-test-account', acc).expect(409);

    const listed = await request(app()).get('/api/v1/webhooks/endpoints').set('x-test-account', acc);
    expect(listed.body.data.endpoints[0]).toMatchObject({ active: false, consecutiveFailures: 4 });
    expect(listed.body.data.endpoints[0].secret).toBeUndefined();

    const on = await request(app()).patch(`/api/v1/webhooks/endpoints/${endpointId}`).set('x-test-account', acc).send({ active: true });
    expect(on.body.data.endpoint).toMatchObject({ active: true, consecutiveFailures: 0, failingSince: null, disabledAt: null, disabledReason: null });
  });

  it('refuses private, loopback and link-local targets, and http in production', async () => {
    delete process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS;
    const acc = account('ssrf');
    __setWebhookResolver(async (host) => {
      const table: Record<string, string> = {
        'hooks.example.com': '93.184.216.34',
        'rebind.example.com': '10.1.2.3',
        'metadata.example.com': '169.254.169.254',
        'v6.example.com': 'fd00::1',
      };
      if (!table[host]) throw new Error('ENOTFOUND');
      return [{ address: table[host]!, family: table[host]!.includes(':') ? 6 : 4 }];
    });

    for (const url of [
      `${base}/hook/x`,
      'http://localhost:4140/api/v1/admin',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]:6379/',
      'http://10.0.0.5/',
      'http://100.100.1.1/', // the tailnet
      'http://[::ffff:127.0.0.1]/',
      'https://rebind.example.com/hook',
      'https://metadata.example.com/hook',
      'https://v6.example.com/hook',
      'https://nowhere.example.com/hook',
      'https://db.internal/hook',
      'ftp://hooks.example.com/hook',
    ]) {
      const res = await register(acc, { url, events: ['*'] });
      expect(res.status, url).toBe(400);
      expect(res.body.error.code, url).toBe('VALIDATION');
    }
    const okRes = await register(acc, { url: 'https://hooks.example.com/hook', events: ['*'] });
    expect(okRes.status).toBe(201);
    const endpointId = okRes.body.data.endpoint.id;
    // …and a URL change goes through the same check.
    await request(app()).patch(`/api/v1/webhooks/endpoints/${endpointId}`).set('x-test-account', acc)
      .send({ url: 'http://127.0.0.1:9/' }).expect(400);
    expect(await prisma.webhookEndpoint.count({ where: { accountId: acc } })).toBe(1);

    const prevEnv = process.env.NODE_ENV;
    try {
      // Production — and any NODE_ENV that is not development/test, unset included.
      for (const env of ['production', 'staging', undefined]) {
        if (env === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = env;
        const plain = await register(acc, { url: 'http://hooks.example.com/hook', events: ['*'] });
        expect(plain.status, String(env)).toBe(400);
        expect(plain.body.error.message).toMatch(/https/);
        // The dev escape hatch does nothing there.
        process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS = 'true';
        expect((await register(acc, { url: 'https://rebind.example.com/hook', events: ['*'] })).status, String(env)).toBe(400);
        delete process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS;
      }
    } finally {
      process.env.NODE_ENV = prevEnv;
      delete process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS;
    }

    // At delivery time too: the name now resolves somewhere private (DNS rebinding).
    __setWebhookResolver(async () => [{ address: '10.9.9.9', family: 4 }]);
    await fanOutEvent(await emit(acc, 'fulkruma.license.revoked.v1'));
    expect(await deliverDueWebhooks()).toBe(1);
    const row = await prisma.webhookEvent.findFirstOrThrow({ where: { endpointId }, include: { deliveryAttempts: true } });
    expect(row.responseCode).toBeNull();
    expect(row.lastError).toMatch(/^blocked: hooks\.example\.com resolves to a private, loopback or link-local address \(10\.9\.9\.9\)$/);
    expect(row.deliveryAttempts[0]).toMatchObject({ status: 'failed', responseCode: null });

    // A loopback endpoint that was allowed when registered (dev) is still refused when sent.
    process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS = 'true';
    const loop = (await register(acc, { url: `${base}/hook/loop`, events: ['*'] })).body.data.endpoint.id;
    delete process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS;
    await fanOutEvent(await emit(acc, 'fulkruma.license.revoked.v1'));
    await deliverDueWebhooks();
    expect(hits('/hook/loop')).toHaveLength(0);
    expect((await prisma.webhookEvent.findFirstOrThrow({ where: { endpointId: loop } })).lastError).toMatch(/^blocked: /);

    for (const [addr, blocked] of [
      ['127.0.0.1', true], ['10.0.0.1', true], ['172.31.255.255', true], ['192.168.0.1', true],
      ['169.254.169.254', true], ['100.64.0.1', true], ['0.0.0.0', true], ['::1', true], ['fe80::1', true],
      ['fc00::1', true], ['::ffff:10.0.0.1', true], ['::', true],
      ['8.8.8.8', false], ['93.184.216.34', false], ['172.32.0.1', false], ['2606:4700:4700::1111', false], ['::ffff:8.8.8.8', false],
    ] as const) {
      expect(isBlockedAddress(addr), addr).toBe(blocked);
    }
  });

  it('validates subscriptions and pages the delivery log', async () => {
    const acc = account('list');
    const bad = await register(acc, { url: `${base}/hook/v`, events: ['shipment.created'] });
    expect(bad.status).toBe(400);
    const endpointId = (await register(acc, { url: `${base}/hook/v`, events: ['fulkruma.license.*'] })).body.data.endpoint.id;
    for (let i = 0; i < 3; i++) await fanOutEvent(await emit(acc, 'fulkruma.license.issued.v1', { i }));
    await fanOutEvent(await emit(acc, 'fulkruma.license.revoked.v1'));
    await deliverDueWebhooks();

    const page1 = await request(app()).get('/api/v1/webhooks/events?limit=2').set('x-test-account', acc);
    expect(page1.body.data.events).toHaveLength(2);
    expect(page1.body.data.nextCursor).toBeTruthy();
    const page2 = await request(app()).get(`/api/v1/webhooks/events?limit=2&cursor=${page1.body.data.nextCursor}`).set('x-test-account', acc);
    expect(page2.body.data.events).toHaveLength(2);
    expect(page2.body.data.nextCursor).toBeNull();
    const ids = [...page1.body.data.events, ...page2.body.data.events].map((e: { id: string }) => e.id);
    expect(new Set(ids).size).toBe(4);

    const revoked = await request(app()).get('/api/v1/webhooks/events?type=fulkruma.license.revoked.v1').set('x-test-account', acc);
    expect(revoked.body.data.events).toHaveLength(1);
    expect(revoked.body.data.events[0]).toMatchObject({ endpointId, status: 'sent', attempts: 1 });
    expect(revoked.body.data.events[0].deliveryAttempts).toHaveLength(1);
    await request(app()).get('/api/v1/webhooks/events?status=bogus').set('x-test-account', acc).expect(400);
  });

  it('keeps delivering to the partner (Storlaunch) while merchants get their own copy', async () => {
    const acc = account('partner');
    const endpointId = (await register(acc, { url: `${base}/hook/merchant`, events: ['*'] })).body.data.endpoint.id;
    const partnerSecret = 'partner-secret-for-test';
    process.env.STORLAUNCH_WEBHOOK_URL = `${base}/partner/storlaunch`;
    process.env.FULKRUMA_OUTBOX_SECRET = partnerSecret;

    // The partner is down: the event stays unpublished and is handled again…
    answers.set('/partner/storlaunch', 500);
    const ev = await emit(acc, 'fulkruma.shipment.status_updated.v1', { shipmentId: 'shp_1', status: 'picked_up' });
    await processOutboxBatch();
    expect((await prisma.outboxEvent.findUnique({ where: { id: ev.id } }))!.publishedAt).toBeNull();
    answers.set('/partner/storlaunch', 200);
    await processOutboxBatch();
    expect((await prisma.outboxEvent.findUnique({ where: { id: ev.id } }))!.publishedAt).not.toBeNull();

    const partnerHits = hits('/partner/storlaunch');
    expect(partnerHits).toHaveLength(2);
    const last = partnerHits[1]!;
    const event = verifyWebhook({ rawBody: last.body, signature: last.headers['fulkruma-signature'] as string, secret: partnerSecret });
    expect(event.id).toBe(ev.id);

    // …but the merchant's delivery was queued once, and goes out once.
    expect(await prisma.webhookEvent.count({ where: { endpointId } })).toBe(1);
    await deliverDueWebhooks();
    expect(hits('/hook/merchant')).toHaveLength(1);
  });

  it('prunes finished deliveries older than 30 days, never pending ones', async () => {
    const acc = account('prune');
    const reg = await register(acc, { url: `${base}/hook/prune`, events: ['*'] });
    const endpointId = reg.body.data.endpoint.id as string;
    await emit(acc, 'fulkruma.stock.adjusted.v1', { variantId: 'var_old' });
    await emit(acc, 'fulkruma.stock.adjusted.v1', { variantId: 'var_recent' });
    await processOutboxBatch();
    await deliverDueWebhooks();
    const rows = await prisma.webhookEvent.findMany({ where: { endpointId }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => r.status)).toEqual(['sent', 'sent']);
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await prisma.webhookEvent.update({ where: { id: rows[0]!.id }, data: { createdAt: old } });
    // a delivery still being retried is kept however old it is
    await prisma.webhookEvent.update({ where: { id: rows[1]!.id }, data: { createdAt: old, status: 'pending', nextRetryAt: new Date(Date.now() + 3600_000) } });

    expect(await pruneOldDeliveries()).toBe(1);
    const left = await prisma.webhookEvent.findMany({ where: { endpointId } });
    expect(left.map((r) => r.id)).toEqual([rows[1]!.id]);
    expect(await prisma.webhookDeliveryAttempt.count({ where: { webhookEventId: rows[0]!.id } })).toBe(0);
  });
});
