import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestId } from '../middleware/auth.js';

/*
 * /api/v1/admin/crm/* — the cross-product CRM connector consumed by the
 * central Forjio admin portal (secret-only auth). Prisma is mocked so
 * the contract shape is testable without a database. Also guards the
 * mount-order regression: /admin/crm must be reachable with ONLY the
 * X-Forjio-Admin-Secret header (the partner /admin router's requireAuth
 * would 401 it).
 */

const SECRET = 'test-forjio-admin-secret';
process.env.FULKRUMA_FORJIO_ADMIN_SECRET = SECRET;

const now = new Date('2026-06-01T00:00:00.000Z');

vi.mock('../lib/db.js', () => ({
  prisma: {
    shipment: {
      count: vi.fn(async ({ where }: { where?: { status?: string } } = {}) =>
        where?.status === 'delivered' ? 3 : 4,
      ),
      groupBy: vi.fn(async (args: { by: string[]; where?: unknown; _count?: unknown }) => {
        if (args.where) return [{ accountId: 'acc_1', _count: { _all: 3 } }];
        if (args._count) {
          return [
            {
              accountId: 'acc_1',
              _count: { _all: 4 },
              _min: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
              _max: { createdAt: now },
            },
          ];
        }
        return [{ accountId: 'acc_1' }];
      }),
      findMany: vi.fn(async () => [
        {
          id: 'shp_1',
          accountId: 'acc_1',
          courierCode: 'jne',
          courierServiceCode: 'reg',
          waybillId: 'WB123',
          status: 'delivered',
          price: 15000,
          insurance: 0,
          createdAt: now,
        },
      ]),
    },
    shippingCreditTransaction: {
      aggregate: vi.fn(async ({ where }: { where?: { kind?: string } }) => ({
        _sum: { amount: where?.kind === 'topup' ? 100000 : -45000 },
      })),
      groupBy: vi.fn(async (args: { where?: unknown }) =>
        args.where
          ? [{ accountId: 'acc_1', _sum: { amount: -45000 } }]
          : [{ accountId: 'acc_1', _max: { createdAt: now } }],
      ),
      findMany: vi.fn(async () => [
        {
          id: 'sct_1',
          accountId: 'acc_1',
          kind: 'topup',
          amount: 100000,
          balanceAfter: 100000,
          shipmentId: null,
          externalRef: 'inv_1',
          memo: 'Top-up via Plugipay',
          createdAt: now,
        },
      ]),
    },
    shippingCredit: {
      aggregate: vi.fn(async () => ({ _sum: { balance: 55000 } })),
      findMany: vi.fn(async () => [
        { accountId: 'acc_1', balance: 55000, createdAt: new Date('2026-01-02T00:00:00.000Z') },
      ]),
    },
    partnerWorkspace: {
      findMany: vi.fn(async () => [
        {
          accountId: 'acc_1',
          partner: 'storlaunch',
          discountRate: 0.1,
          brandName: 'Toko Satu',
          businessEmail: 'owner@tokosatu.id',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: now,
        },
      ]),
    },
    subscription: { findMany: vi.fn(async () => []) },
    biteshipConfig: { findMany: vi.fn(async () => []) },
  },
}));

function makeApp(routes: express.Router) {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.use('/api/v1', routes);
  return app;
}

describe('/api/v1/admin/crm', () => {
  let app: express.Express;

  beforeAll(async () => {
    const routes = (await import('../routes/index.js')).default;
    app = makeApp(routes);
  });

  it('401s every CRM endpoint without the admin secret', async () => {
    for (const path of ['stats', 'customers', 'transactions']) {
      const res = await request(app).get(`/api/v1/admin/crm/${path}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    }
  });

  it('serves stats with ONLY the secret header (mount-order regression)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/crm/stats')
      .set('x-forjio-admin-secret', SECRET);
    expect(res.status).toBe(200);
    const { stats } = res.body.data;
    expect(Array.isArray(stats)).toBe(true);
    expect(stats.length).toBeGreaterThanOrEqual(4);
    expect(stats.length).toBeLessThanOrEqual(6);
    for (const s of stats) {
      expect(typeof s.key).toBe('string');
      expect(typeof s.label).toBe('string');
      expect(typeof s.value).toBe('string');
    }
    const byKey = Object.fromEntries(stats.map((s: { key: string; value: string }) => [s.key, s.value]));
    expect(byKey.shipments_total).toBe('4');
    expect(byKey.delivered_rate).toBe('75.0%');
    expect(byKey.shipping_spend).toBe('Rp 45.000');
    expect(byKey.credit_outstanding).toBe('Rp 55.000');
  });

  it('serves customers in the portal contract shape', async () => {
    const res = await request(app)
      .get('/api/v1/admin/crm/customers')
      .set('x-forjio-admin-secret', SECRET);
    expect(res.status).toBe(200);
    const { customers } = res.body.data;
    expect(customers).toHaveLength(1);
    const c = customers[0];
    expect(c.id).toBe('acc_1');
    expect(c.email).toBe('owner@tokosatu.id');
    expect(c.name).toBe('Toko Satu');
    expect(c.signupAt).toBe('2026-01-01T00:00:00.000Z');
    expect(c.lastActiveAt).toBe(now.toISOString());
    expect(c.status).toBe('via storlaunch');
    expect(Array.isArray(c.metrics)).toBe(true);
    for (const m of c.metrics) {
      expect(typeof m.label).toBe('string');
      expect(typeof m.value).toBe('string');
    }
  });

  it('serves transactions (shipments + credit ledger merged) with summary', async () => {
    const res = await request(app)
      .get('/api/v1/admin/crm/transactions?limit=50')
      .set('x-forjio-admin-secret', SECRET);
    expect(res.status).toBe(200);
    const { summary, rows } = res.body.data;
    expect(Array.isArray(summary)).toBe(true);
    for (const s of summary) {
      expect(typeof s.label).toBe('string');
      expect(typeof s.value).toBe('string');
    }
    expect(rows).toHaveLength(2); // 1 shipment + 1 credit txn
    const kinds = rows.map((r: { kind: string }) => r.kind).sort();
    expect(kinds).toEqual(['credit_topup', 'shipment']);
    const ship = rows.find((r: { kind: string }) => r.kind === 'shipment');
    expect(ship.amount).toBe('Rp 15.000');
    expect(ship.customer).toBe('Toko Satu');
    expect(ship.description).toContain('JNE');
    expect(ship.description).toContain('WB123');
    expect(typeof ship.at).toBe('string');
  });
});
