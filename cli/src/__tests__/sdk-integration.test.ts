/**
 * Integration sanity-check: verify the real `@forjio/fulkruma-node`
 * client hits the URLs + HTTP methods we expect for the headline SDK
 * calls used by the CLI. Mocks global fetch and snapshots the request
 * line for a sample of routes.
 *
 * If this file ever breaks after an SDK bump, it's the canary that the
 * CLI's per-group tests (which mock the SDK at the *method* level) are
 * no longer enough to catch URL/method regressions.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FulkrumaClient } from '@forjio/fulkruma-node';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

let captured: CapturedRequest | null;
let originalFetch: typeof fetch;

function envelope(data: unknown): Response {
  const body = JSON.stringify({
    data,
    error: null,
    meta: { requestId: 'req_test', timestamp: new Date().toISOString() },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  captured = null;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    captured = {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body: init?.body ? String(init.body) : undefined,
    };
    return envelope({ products: [], warehouses: [], stock: [], shipments: [] });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeClient(): FulkrumaClient {
  return new FulkrumaClient({
    keyId: 'AKIAFULKTEST',
    secret: 'shh',
    baseUrl: 'https://fulkruma.test',
  });
}

describe('SDK URL + method contract', () => {
  it('products.list → GET /v1/products', async () => {
    await makeClient().products.list();
    expect(captured?.method).toBe('GET');
    expect(captured?.url).toMatch(/\/v1\/products(\?|$)/);
  });

  it('warehouses.list → GET /v1/warehouses', async () => {
    await makeClient().warehouses.list();
    expect(captured?.method).toBe('GET');
    expect(captured?.url).toMatch(/\/v1\/warehouses(\?|$)/);
  });

  it('stock.levels → GET /v1/stock/levels', async () => {
    await makeClient().stock.levels({ variant_id: 'v_1' });
    expect(captured?.method).toBe('GET');
    expect(captured?.url).toMatch(/\/v1\/stock\/levels/);
    expect(captured?.url).toContain('variant_id=v_1');
  });

  it('shipments.list → GET /v1/shipments', async () => {
    await makeClient().shipments.list();
    expect(captured?.method).toBe('GET');
    expect(captured?.url).toMatch(/\/v1\/shipments(\?|$)/);
  });
});
