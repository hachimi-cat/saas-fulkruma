import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../index.js';
import { API_ROUTES } from '../commands/api.generated.js';
import { installFakeClient, runCli, silenceStdio, type FakeClient } from './helpers.js';
import { resetClientFactory } from '../lib/client.js';

// `fulkruma api <area> <action>`: every feature route, generated from the API spec.
let fake: FakeClient;

beforeEach(() => {
  process.env['FULKRUMA_KEY_ID'] = 'AKIA';
  process.env['FULKRUMA_SECRET'] = 'x';
  fake = installFakeClient();
});

afterEach(() => {
  resetClientFactory();
});

async function run(argv: string[]): Promise<void> {
  const s = silenceStdio();
  try {
    await runCli(buildProgram, argv);
  } finally {
    s.restore();
  }
}

function requests(): Array<{ method: string; path: string; body?: unknown; idempotencyKey?: string }> {
  return fake.calls
    .filter((c) => c.group === 'client' && c.method === 'request')
    .map((c) => c.args[0] as { method: string; path: string; body?: unknown; idempotencyKey?: string });
}

describe('fulkruma api', () => {
  it('has a command for every feature route', () => {
    const count = API_ROUTES.reduce((n, a) => n + a.routes.length, 0);
    expect(count).toBeGreaterThan(70);
    expect(API_ROUTES.map((a) => a.area)).toContain('warehouses');
  });

  it('creates a product from flags, typed as the spec says', async () => {
    await run(['api', 'products', 'create', '--name', 'Kopi Susu', '--type', 'physical', '--weight', '250', '--license-enabled', 'false']);
    const [req] = requests();
    expect(req).toMatchObject({
      method: 'POST',
      path: '/api/v1/products',
      body: { name: 'Kopi Susu', type: 'physical', weight: 250, licenseEnabled: false },
    });
    expect(req!.idempotencyKey).toMatch(/^idem_/);
  });

  it('refuses a value the spec does not allow', async () => {
    await expect(run(['api', 'products', 'create', '--name', 'X', '--type', 'service'])).rejects.toThrow(/__exit:1/);
    await expect(run(['api', 'products', 'create', '--type', 'physical'])).rejects.toThrow(/__exit:1/);
    expect(requests()).toHaveLength(0);
  });

  it('puts path parameters in the path and query fields in the query', async () => {
    await run(['api', 'products', 'get', 'prd 1']);
    await run(['api', 'shipments', 'list', '--status', 'delivered']);
    const [get, list] = requests();
    expect(get).toMatchObject({ method: 'GET', path: '/api/v1/products/prd%201', body: undefined, idempotencyKey: undefined });
    expect(list).toMatchObject({ method: 'GET', path: '/api/v1/shipments?status=delivered' });
  });

  it('sends no body when no field is given (the server signs {} as an empty body)', async () => {
    await run(['api', 'shipments', 'cancel', 'shp_1']);
    await run(['api', 'shipments', 'cancel', 'shp_1', '--reason', 'Buyer changed address']);
    const [bare, withReason] = requests();
    expect(bare).toMatchObject({ method: 'POST', path: '/api/v1/shipments/shp_1/cancel', body: undefined });
    expect(withReason!.body).toEqual({ reason: 'Buyer changed address' });
  });
});
