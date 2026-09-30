import crypto from 'node:crypto';
import { describe, it, expect, afterEach } from 'vitest';
import { FulkrumaClient } from '../src/index.js';

// The signature covers exactly the bytes sent ('' when none). The server accepts a
// signature over the raw bytes it received (backend middleware/hmac-auth.ts), and — as
// the deployed server still requires — over its own re-serialisation, where an empty
// {} counts as ''. Sending no body for an empty one satisfies both.
const SECRET = 'fulksk_test_secret';

describe('request signing', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  function capture() {
    const seen: Array<{ method: string; path: string; body: string | null; headers: Headers }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input.toString());
      seen.push({
        method: init?.method ?? 'GET',
        path: url.pathname + url.search,
        body: typeof init?.body === 'string' ? init.body : null,
        headers: new Headers(init?.headers),
      });
      return new Response(JSON.stringify({ data: {}, error: null, meta: { requestId: 'r' } }));
    }) as typeof fetch;
    return seen;
  }

  /** What the server computes for these bytes, as hmac-auth.ts does. */
  function expected(req: { method: string; path: string; body: string | null; headers: Headers }) {
    const bodyHash = crypto.createHash('sha256').update(Buffer.from(req.body ?? '', 'utf8')).digest('hex');
    const idem = req.headers.get('idempotency-key');
    const ts = req.headers.get('x-fulkruma-timestamp');
    const toSign = `${req.method}\n${req.path}\n${ts}\n${bodyHash}${idem ? `\n${idem}` : ''}`;
    return crypto.createHmac('sha256', SECRET).update(toSign).digest('hex');
  }
  const signatureOf = (h: Headers) => /signature=([0-9a-f]{64})$/.exec(h.get('authorization') ?? '')?.[1];

  it('sends no body, and signs none, for the calls that carry nothing', async () => {
    const seen = capture();
    const c = new FulkrumaClient({ keyId: 'AKIAFULKTEST', secret: SECRET, baseUrl: 'https://fulkruma.test' });
    await c.licenses.revoke('lic_1');
    await c.apiKeys.revoke('ak_1');
    await c.billing.cancel();
    await c.shipments.cancel('shp_1');
    await c.api.shipmentsCancel('shp_2');
    for (const req of seen) {
      expect(req.body, `${req.method} ${req.path}`).toBeNull();
      expect(req.headers.get('content-type')).toBeNull();
      expect(signatureOf(req.headers), `${req.method} ${req.path}`).toBe(expected(req));
    }
    expect(seen.map((r) => r.path)).toEqual([
      '/api/v1/licenses/lic_1/revoke', '/api/v1/api-keys/ak_1/revoke', '/api/v1/billing/cancel',
      '/api/v1/shipments/shp_1/cancel', '/api/v1/shipments/shp_2/cancel',
    ]);
  });

  it('signs exactly the bytes it sends, non-ASCII text and floats included', async () => {
    const seen = capture();
    const c = new FulkrumaClient({ keyId: 'AKIAFULKTEST', secret: SECRET, baseUrl: 'https://fulkruma.test' });
    await c.warehouses.create({ name: 'Gudang Café — 東京 <main> & co', lat: -6.2, lng: 106.8 });
    await c.stock.adjust({ variantId: 'v1', warehouseId: 'w1', delta: 3, reason: 'restock' as never });
    for (const req of seen) {
      expect(req.body).not.toBeNull();
      expect(signatureOf(req.headers)).toBe(expected(req));
    }
    expect(seen[0]!.body).toBe('{"name":"Gudang Café — 東京 <main> & co","lat":-6.2,"lng":106.8}');
  });
});
