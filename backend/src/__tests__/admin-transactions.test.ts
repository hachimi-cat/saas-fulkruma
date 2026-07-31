import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestId } from '../middleware/auth.js';

/*
 * The Transactions adapter.
 *
 * The invariant worth defending across the whole family: this page is the
 * ITEMISATION of the number on the Business metrics tile. Same table,
 * same filter, same window. If the two drift an operator sees two
 * different revenue figures for the same month and has no way to tell
 * which is real — so these tests assert the filter, not just the output.
 */

// Hoisted: `../lib/db.js` is imported eagerly by middleware that loads
// during collection, so the mock factory runs before ordinary top-level
// consts exist.
const { findMany, aggregate } = vi.hoisted(() => ({
  findMany: vi.fn(),
  aggregate: vi.fn(),
}));

vi.mock('../lib/db.js', () => {
  // Every OTHER model answers with a no-op, so importing the whole route
  // tree does not require stubbing tables these tests never touch.
  const invoice = { findMany, aggregate };
  const prisma = new Proxy(
    { invoice },
    {
      get: (target: Record<string, unknown>, key: string) =>
        key in target
          ? target[key]
          : new Proxy({}, { get: () => vi.fn(async () => []) }),
    },
  );
  return { prisma };
});

// Authenticate the way a server-to-server caller does, rather than
// stubbing the guard away: that keeps the guard itself in the path, so a
// route mounted without it would fail here instead of passing.
const ADMIN_SECRET = 'test-admin-secret';
process.env.FULKRUMA_FORJIO_ADMIN_SECRET = ADMIN_SECRET;

function invoice(over: Record<string, unknown> = {}) {
  return {
    id: 'inv_1',
    accountId: 'acc_a',
    amount: 99_000,
    currency: 'IDR',
    paidAt: new Date('2026-07-20T00:00:00Z'),
    plan: 'growth',
    plugipayInvoiceId: 'pi_1',
    ...over,
  };
}

async function get(qs = '') {
  const routes = (await import('../routes/index.js')).default;
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.use('/api/v1', routes);
  return request(app)
    .get(`/api/v1/admin/transactions${qs}`)
    .set('X-Forjio-Admin-Secret', ADMIN_SECRET);
}

beforeEach(() => {
  vi.resetModules();
  findMany.mockReset();
  aggregate.mockReset();
  findMany.mockResolvedValue([]);
  aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { amount: 0 } });
});

describe('GET /api/v1/admin/transactions', () => {
  it('is reached at all — the bare /admin router must not shadow it', async () => {
    // routes/index.ts mounts a partner-billing router at '/admin', which
    // matches EVERY path beneath it and runs requireAuth first. Mounted
    // above the admin-portal routes it swallowed all of them, and every
    // page in this product's admin portal returned "Missing Authorization
    // header" in production while the routes were perfectly fine. A 401
    // here means that regression is back.
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
  });

  it('counts only invoices that were PAID, keyed on when they were paid', async () => {
    await get();
    // paidAt, not createdAt: an invoice raised in one month and settled
    // the next belongs to the month a bank statement will agree with.
    const where = findMany.mock.calls[0]![0].where;
    expect(where.status).toBe('paid');
    expect(where.paidAt).toEqual({ gte: expect.any(Date), lte: expect.any(Date) });
    expect(where.createdAt).toBeUndefined();
  });

  it('aggregates the summary over the WINDOW, not over the rows on screen', async () => {
    // The page caps rows; a busy month past that cap must still report
    // what it took, or the summary silently under-reports revenue.
    findMany.mockResolvedValue([invoice()]);
    aggregate.mockResolvedValue({ _count: { _all: 900 }, _sum: { amount: 12_000_000 } });
    const body = (await get()).body.data;
    expect(body.rows).toHaveLength(1);
    expect(body.summary.count).toBe(900);
    expect(body.summary.grossMinor).toBe(1_200_000_000);
    // The aggregate must run against the same filter as the page.
    expect(aggregate.mock.calls[0]![0].where).toEqual(findMany.mock.calls[0]![0].where);
  });

  it('converts whole rupiah to MINOR units exactly once', async () => {
    findMany.mockResolvedValue([invoice({ amount: 99_000 })]);
    const row = (await get()).body.data.rows[0];
    expect(row.amountMinor).toBe(9_900_000);
  });

  it('carries each row\'s OWN currency', async () => {
    // A USD invoice rendered as rupiah is off by a factor of sixteen
    // thousand, and nothing on screen would give that away.
    findMany.mockResolvedValue([invoice({ currency: 'USD' })]);
    expect((await get()).body.data.rows[0].currency).toBe('USD');
  });

  it('clamps a silly window instead of rejecting it', async () => {
    await get('?days=100000');
    const { gte, lte } = findMany.mock.calls[0]![0].where.paidAt;
    const days = Math.round((lte.getTime() - gte.getTime()) / 86_400_000);
    expect(days).toBe(365);
  });

  it('serves an empty ledger rather than erroring when nothing was paid', async () => {
    const body = (await get()).body.data;
    expect(body.rows).toEqual([]);
    expect(body.summary).toEqual({ count: 0, grossMinor: 0, currency: 'IDR', payers: 0 });
  });
});
