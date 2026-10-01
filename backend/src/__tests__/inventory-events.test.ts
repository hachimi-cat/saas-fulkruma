import { afterAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';

/*
 * The inventory events a merchant subscribes to, against a real Postgres (CI's `test` job
 * migrates one; locally: DATABASE_URL=… npx prisma migrate deploy):
 *
 *  - fulkruma.warehouse.created.v1 — once per POST /warehouses, in the create's transaction;
 *  - fulkruma.stock.low.v1 — when POST /stock/adjust takes a level from at or above the
 *    variant's lowStockThreshold to below it: only on that crossing, never for a variant
 *    without a threshold, and found for a synced Storlaunch variant by its externalRef.
 *
 * Only `requireAuth` is replaced (the account comes from a test header).
 */
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const accountId = req.header('x-test-account');
    if (accountId) req.auth = { accountId, sub: 'usr_test' } as never;
    next();
  },
}));

const HAS_DB = Boolean(process.env.DATABASE_URL);

const { prisma } = await import('../lib/db.js');
const { default: warehousesRouter } = await import('../routes/warehouses.js');
const { default: stockRouter } = await import('../routes/stock.js');

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/v1/warehouses', warehousesRouter);
  a.use('/api/v1/stock', stockRouter);
  return a;
}

const run = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const accounts: string[] = [];
function account(tag: string) {
  const id = `acc_invtest_${run}_${tag}`;
  accounts.push(id);
  return id;
}

async function warehouse(accountId: string, name = 'Main') {
  const res = await request(app()).post('/api/v1/warehouses').set('x-test-account', accountId).send({ name }).expect(201);
  return res.body.data.warehouse as { id: string };
}

async function adjust(accountId: string, variantId: string, warehouseId: string, delta: number) {
  return request(app())
    .post('/api/v1/stock/adjust')
    .set('x-test-account', accountId)
    .send({ variantId, warehouseId, delta, reason: delta >= 0 ? 'initial_stock' : 'manual_adjust' })
    .expect(200);
}

const lows = (accountId: string) =>
  prisma.outboxEvent.findMany({ where: { accountId, type: 'fulkruma.stock.low.v1' }, orderBy: { createdAt: 'asc' } });

describe.skipIf(!HAS_DB)('inventory events (real database)', () => {
  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { accountId: { in: accounts } } });
    await prisma.warehouse.deleteMany({ where: { accountId: { in: accounts } } });
    await prisma.product.deleteMany({ where: { accountId: { in: accounts } } });
    await prisma.$disconnect();
  });

  it('emits fulkruma.warehouse.created.v1 once per created warehouse', async () => {
    const acc = account('wh');
    const wh = await warehouse(acc, 'Jakarta DC');
    const events = await prisma.outboxEvent.findMany({ where: { accountId: acc, type: 'fulkruma.warehouse.created.v1' } });
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toMatchObject({ id: wh.id, name: 'Jakarta DC', isDefault: true });

    // An invalid create raises nothing; a second warehouse raises its own.
    await request(app()).post('/api/v1/warehouses').set('x-test-account', acc).send({}).expect(400);
    await warehouse(acc, 'Bandung');
    expect(await prisma.outboxEvent.count({ where: { accountId: acc, type: 'fulkruma.warehouse.created.v1' } })).toBe(2);
  });

  it('emits fulkruma.stock.low.v1 only when a level crosses below the threshold', async () => {
    const acc = account('low');
    const wh = await warehouse(acc);
    const product = await prisma.product.create({
      data: { accountId: acc, name: 'Tee', variants: { create: { name: 'Red / M', sku: 'TEE-RM', lowStockThreshold: 5 } } },
      include: { variants: true },
    });
    const variant = product.variants[0]!;

    await adjust(acc, variant.id, wh.id, 10); // 10: not low
    await adjust(acc, variant.id, wh.id, -4); // 6: still at/above 5
    expect(await lows(acc)).toHaveLength(0);

    await adjust(acc, variant.id, wh.id, -2); // 4: crossed
    let events = await lows(acc);
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toMatchObject({
      variantId: variant.id, productVariantId: variant.id, productId: product.id, warehouseId: wh.id,
      sku: 'TEE-RM', quantity: 4, threshold: 5,
    });

    await adjust(acc, variant.id, wh.id, -3); // 1: already low, no repeat
    expect(await lows(acc)).toHaveLength(1);

    await adjust(acc, variant.id, wh.id, 10); // 11: recovered
    await adjust(acc, variant.id, wh.id, -6); // 5: exactly the threshold is not below it
    expect(await lows(acc)).toHaveLength(1);
    await adjust(acc, variant.id, wh.id, -1); // 4: crossed again
    events = await lows(acc);
    expect(events).toHaveLength(2);
    expect(events[1]!.data).toMatchObject({ quantity: 4, threshold: 5 });

    // Each warehouse's level crosses on its own.
    const wh2 = await warehouse(acc, 'Second');
    await adjust(acc, variant.id, wh2.id, 5);
    await adjust(acc, variant.id, wh2.id, -1);
    events = await lows(acc);
    expect(events).toHaveLength(3);
    expect(events[2]!.data).toMatchObject({ warehouseId: wh2.id, quantity: 4 });
  });

  it('never emits for a variant without a threshold, or stock of an unknown variant', async () => {
    const acc = account('nothreshold');
    const wh = await warehouse(acc);
    const product = await prisma.product.create({
      data: { accountId: acc, name: 'Mug', variants: { create: { name: 'Default' } } },
      include: { variants: true },
    });
    await adjust(acc, product.variants[0]!.id, wh.id, 3);
    await adjust(acc, product.variants[0]!.id, wh.id, -3);
    await adjust(acc, 'var_not_a_variant', wh.id, 3);
    await adjust(acc, 'var_not_a_variant', wh.id, -3);
    expect(await lows(acc)).toHaveLength(0);
  });

  it('finds the threshold of a synced Storlaunch variant by its id there', async () => {
    const acc = account('storlaunch');
    const other = account('storlaunch_other');
    const wh = await warehouse(acc);
    await prisma.product.create({
      data: {
        accountId: acc, name: 'Synced', externalSource: 'storlaunch', externalRef: `prod_${run}`,
        variants: { create: { name: 'Default', externalSource: 'storlaunch', externalRef: `var_sl_${run}`, lowStockThreshold: 2 } },
      },
    });
    // Another account's variant with the same external id must not lend its threshold.
    await prisma.product.create({
      data: {
        accountId: other, name: 'Theirs', externalSource: 'storlaunch', externalRef: `prod_${run}`,
        variants: { create: { name: 'Default', externalSource: 'storlaunch', externalRef: `var_sl_other_${run}`, lowStockThreshold: 100 } },
      },
    });
    await adjust(acc, `var_sl_${run}`, wh.id, 3);
    await adjust(acc, `var_sl_${run}`, wh.id, -2);
    const events = await lows(acc);
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toMatchObject({ variantId: `var_sl_${run}`, quantity: 1, threshold: 2 });
    await adjust(acc, `var_sl_other_${run}`, wh.id, 3);
    await adjust(acc, `var_sl_other_${run}`, wh.id, -1);
    expect(await lows(acc)).toHaveLength(1);
  });
});
