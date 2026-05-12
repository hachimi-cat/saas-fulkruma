import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FulkrumaClient } from '../src/index.js';

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function makeClient() {
  const captured: Captured[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: typeof input === 'string' ? input : input.toString(),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    return new Response(
      JSON.stringify({
        data: { ok: true },
        error: null,
        meta: { requestId: 'req_test', timestamp: new Date().toISOString() },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  const client = new FulkrumaClient({ keyId: 'ak_test', secret: 'sk_test', baseUrl: 'https://fulkruma.test' });
  return {
    client,
    captured,
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };
}

describe('v0.2.0 new resources', () => {
  let h: ReturnType<typeof makeClient>;
  beforeEach(() => {
    h = makeClient();
  });
  afterEach(() => h.restore());

  it('apiKeys.create POSTs', async () => {
    await h.client.apiKeys.create({ description: 'CI key' });
    expect(h.captured[0]!.method).toBe('POST');
    expect(h.captured[0]!.url).toContain('/api/v1/api-keys');
  });

  it('apiKeys.revoke posts to /:id/revoke', async () => {
    await h.client.apiKeys.revoke('ak_1');
    expect(h.captured[0]!.url).toContain('/api/v1/api-keys/ak_1/revoke');
    expect(h.captured[0]!.method).toBe('POST');
  });

  it('auditLog.list GETs with query', async () => {
    await h.client.auditLog.list({ limit: 50, eventType: 'shipment.created' });
    const u = new URL(h.captured[0]!.url);
    expect(u.pathname).toBe('/api/v1/audit-log');
    expect(u.searchParams.get('limit')).toBe('50');
    expect(u.searchParams.get('eventType')).toBe('shipment.created');
  });

  it('billing.plans GETs', async () => {
    await h.client.billing.plans();
    expect(h.captured[0]!.url).toContain('/api/v1/billing/plans');
  });

  it('billing.checkout POSTs', async () => {
    await h.client.billing.checkout({ planId: 'pro' });
    expect(h.captured[0]!.method).toBe('POST');
    expect(h.captured[0]!.url).toContain('/api/v1/billing/checkout');
  });

  it('integrations.status GETs', async () => {
    await h.client.integrations.status();
    expect(h.captured[0]!.url).toContain('/api/v1/integrations/status');
  });

  it('stats.overview GETs', async () => {
    await h.client.stats.overview();
    expect(h.captured[0]!.url).toContain('/api/v1/stats/overview');
  });

  it('webhooks.createEndpoint POSTs with idempotency', async () => {
    await h.client.webhooks.createEndpoint({ url: 'https://x.com/hook', events: ['shipment.created'] });
    expect(h.captured[0]!.method).toBe('POST');
    expect(h.captured[0]!.url).toContain('/api/v1/webhooks/endpoints');
    expect(h.captured[0]!.headers['Idempotency-Key']).toBeTruthy();
  });

  it('webhooks.updateEndpoint PATCHes /:id', async () => {
    await h.client.webhooks.updateEndpoint('we_1', { active: false });
    expect(h.captured[0]!.method).toBe('PATCH');
    expect(h.captured[0]!.url).toContain('/api/v1/webhooks/endpoints/we_1');
  });

  it('webhooks.deleteEndpoint DELETEs', async () => {
    await h.client.webhooks.deleteEndpoint('we_1');
    expect(h.captured[0]!.method).toBe('DELETE');
  });

  it('HMAC headers attached', async () => {
    await h.client.billing.plans();
    expect(h.captured[0]!.headers.Authorization).toMatch(/^Fulkruma-HMAC-SHA256/);
    expect(h.captured[0]!.headers['X-Fulkruma-Timestamp']).toMatch(/^\d+$/);
  });
});
