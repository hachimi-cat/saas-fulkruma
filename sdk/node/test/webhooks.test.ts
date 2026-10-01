import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FulkrumaClient, verifyWebhook } from '../src/index.js';

// The vector the backend's signer is tested against
// (backend/src/__tests__/merchant-webhooks.test.ts) and the Python and Go
// helpers check too: the server and all three SDKs agree on the signature.
const VECTOR = {
  secret: 'whsec_fulkruma_test_vector_0001',
  t: 1767225600,
  body: '{"id":"evt_01JTESTVECTOR0000000000000","type":"fulkruma.shipment.created.v1","occurredAt":"2026-01-01T00:00:00.000Z","accountId":"acc_test","data":{"shipmentId":"shp_1","note":"café — 日本"},"metadata":{}}',
  header: 't=1767225600,v1=812b74713b8424ca6d154b60ee47541f37a0635d82f5ed55e83d949576e73fa1',
};

describe('verifyWebhook', () => {
  const realNow = Date.now;
  beforeEach(() => { Date.now = () => (VECTOR.t + 30) * 1000; });
  afterEach(() => { Date.now = realNow; });

  it('accepts what the Fulkruma server signs', () => {
    const event = verifyWebhook({ rawBody: VECTOR.body, signature: VECTOR.header, secret: VECTOR.secret });
    expect(event.id).toBe('evt_01JTESTVECTOR0000000000000');
    expect(event.type).toBe('fulkruma.shipment.created.v1');
    expect((event.data as { note: string }).note).toBe('café — 日本');
  });

  it('accepts the raw body as a Buffer, and spaces in the header', () => {
    const header = VECTOR.header.replace(',', ', ');
    expect(verifyWebhook({ rawBody: Buffer.from(VECTOR.body, 'utf8'), signature: header, secret: VECTOR.secret }).id)
      .toBe('evt_01JTESTVECTOR0000000000000');
  });

  it('rejects a wrong secret, a changed body, a stale timestamp and a missing header', () => {
    expect(() => verifyWebhook({ rawBody: VECTOR.body, signature: VECTOR.header, secret: 'whsec_other' })).toThrow('bad signature');
    expect(() => verifyWebhook({ rawBody: VECTOR.body.replace('shp_1', 'shp_2'), signature: VECTOR.header, secret: VECTOR.secret })).toThrow('bad signature');
    // The same body re-serialised (here: pretty-printed) is not what was signed.
    expect(() => verifyWebhook({ rawBody: JSON.stringify(JSON.parse(VECTOR.body), null, 2), signature: VECTOR.header, secret: VECTOR.secret })).toThrow();
    Date.now = () => (VECTOR.t + 301) * 1000;
    expect(() => verifyWebhook({ rawBody: VECTOR.body, signature: VECTOR.header, secret: VECTOR.secret })).toThrow(/tolerance/);
    expect(() => verifyWebhook({ rawBody: VECTOR.body, signature: undefined, secret: VECTOR.secret })).toThrow(/missing/);
  });

  it('round-trips a fresh signature made the way the server makes it', () => {
    Date.now = realNow;
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ id: 'evt_x', type: 'fulkruma.license.issued.v1', occurredAt: new Date().toISOString(), accountId: 'acc', data: {}, metadata: {} });
    const v1 = crypto.createHmac('sha256', VECTOR.secret).update(`${t}.${body}`).digest('hex');
    expect(verifyWebhook({ rawBody: body, signature: `t=${t},v1=${v1}`, secret: VECTOR.secret }).type).toBe('fulkruma.license.issued.v1');
  });
});

describe('webhooks delivery log', () => {
  const realFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: unknown }> = [];
  beforeEach(() => {
    calls.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET', headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body });
      return new Response(JSON.stringify({ data: { events: [], nextCursor: null }, error: null, meta: { requestId: 'r' } }));
    }) as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = realFetch; });
  const client = () => new FulkrumaClient({ keyId: 'AKIAFULKTEST', secret: 's', baseUrl: 'https://fulkruma.test' });

  it('listEvents sends the filters and page cursor as query parameters', async () => {
    await client().webhooks.listEvents({ limit: 20, status: 'failed', endpointId: 'ep_1', cursor: 'cur_1' });
    const u = new URL(calls[0]!.url);
    expect(u.pathname).toBe('/api/v1/webhooks/events');
    expect(Object.fromEntries(u.searchParams)).toEqual({ limit: '20', status: 'failed', endpointId: 'ep_1', cursor: 'cur_1' });
    await client().webhooks.listEvents();
    expect(new URL(calls[1]!.url).search).toBe('');
  });

  it('getEvent GETs one delivery; retryEvent POSTs with no body', async () => {
    await client().webhooks.getEvent('whe_1');
    expect(calls[0]).toMatchObject({ method: 'GET' });
    expect(new URL(calls[0]!.url).pathname).toBe('/api/v1/webhooks/events/whe_1');
    await client().webhooks.retryEvent('whe_1');
    expect(calls[1]).toMatchObject({ method: 'POST', body: undefined });
    expect(new URL(calls[1]!.url).pathname).toBe('/api/v1/webhooks/events/whe_1/retry');
    expect(calls[1]!.headers['Idempotency-Key']).toBeTruthy();
  });
});
