import crypto from 'node:crypto';
import { describe, it, expect, afterEach } from 'vitest';
import { FulkrumaClient } from '../src/index.js';

// client.api: every feature route, generated from the API spec (scripts/apigen.sh).
describe('client.api (generated from the spec)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  interface Seen { url: string; method: string; body?: string; headers: Headers }
  function capture() {
    const seen: Seen[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      seen.push({
        url: typeof input === 'string' ? input : input.toString(),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : undefined,
        headers: new Headers(init?.headers),
      });
      return new Response(JSON.stringify({ data: { ok: true }, error: null, meta: { requestId: 'r', timestamp: '' } }), {
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    return seen;
  }

  // The server's recipe (backend middleware/hmac-auth.ts): the path as sent, and the body
  // hashed as JSON.stringify(req.body) — the empty string when there is no field.
  function serverAccepts(req: Seen, secret: string): boolean {
    const u = new URL(req.url);
    const parsed = req.body ? (JSON.parse(req.body) as Record<string, unknown>) : {};
    const bodyJson = Object.keys(parsed).length > 0 ? JSON.stringify(parsed) : '';
    const idem = req.headers.get('idempotency-key');
    const toSign = `${req.method}\n${u.pathname}${u.search}\n${req.headers.get('x-fulkruma-timestamp')}\n${crypto.createHash('sha256').update(bodyJson).digest('hex')}${idem ? `\n${idem}` : ''}`;
    const expected = crypto.createHmac('sha256', secret).update(toSign).digest('hex');
    return (req.headers.get('authorization') ?? '').endsWith(`signature=${expected}`);
  }

  it('creates a warehouse with the fields Fulkruma validates, signed', async () => {
    const seen = capture();
    const client = new FulkrumaClient({ keyId: 'AKIAFULKTEST', secret: 'sk', baseUrl: 'https://fulkruma.test' });
    await client.api.warehousesCreate({ name: 'Gudang Utama', city: 'Jakarta', lat: -6.2, isDefault: true });
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('https://fulkruma.test/api/v1/warehouses');
    expect(JSON.parse(seen[0]!.body!)).toEqual({ name: 'Gudang Utama', city: 'Jakarta', lat: -6.2, isDefault: true });
    expect(seen[0]!.headers.get('authorization')).toMatch(/^Fulkruma-HMAC-SHA256 keyId=AKIAFULKTEST, scope=\*, signature=/);
    expect(seen[0]!.headers.get('idempotency-key')).toBeTruthy();
    expect(serverAccepts(seen[0]!, 'sk')).toBe(true);
  });

  it('puts path parameters in the path and query fields in the query', async () => {
    const seen = capture();
    const client = new FulkrumaClient({ keyId: 'ak', secret: 'sk', baseUrl: 'https://fulkruma.test' });
    await client.api.productsGet('prd 1');
    await client.api.shipmentsList({ status: 'delivered' });
    expect(seen[0]!.url).toBe('https://fulkruma.test/api/v1/products/prd%201');
    const listed = new URL(seen[1]!.url);
    expect(listed.pathname).toBe('/api/v1/shipments');
    expect(Object.fromEntries(listed.searchParams)).toEqual({ status: 'delivered' });
    expect(serverAccepts(seen[0]!, 'sk')).toBe(true);
    expect(serverAccepts(seen[1]!, 'sk')).toBe(true);
  });

  it('sends no body when no field is given, so the server accepts the signature', async () => {
    const seen = capture();
    const client = new FulkrumaClient({ keyId: 'ak', secret: 'sk', baseUrl: 'https://fulkruma.test' });
    await client.api.shipmentsCancel('shp_1');
    expect(seen[0]!.url).toBe('https://fulkruma.test/api/v1/shipments/shp_1/cancel');
    expect(seen[0]!.body).toBeUndefined();
    expect(serverAccepts(seen[0]!, 'sk')).toBe(true);
    await client.api.shipmentsCancel('shp_1', { reason: 'Buyer changed address' });
    expect(JSON.parse(seen[1]!.body!)).toEqual({ reason: 'Buyer changed address' });
    expect(serverAccepts(seen[1]!, 'sk')).toBe(true);
  });

  it('has a method for every feature route', () => {
    const client = new FulkrumaClient({ keyId: 'ak', secret: 'sk' });
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client.api)).filter((n) => n !== 'constructor' && n !== 'call');
    expect(methods.length).toBeGreaterThan(70);
  });
});
