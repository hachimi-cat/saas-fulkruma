import { afterAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';

/*
 * The catalog and digital-delivery events, against a real Postgres (CI's `test` job
 * migrates one; locally: DATABASE_URL=… npx prisma migrate deploy):
 *
 *  - fulkruma.product.updated.v1 — PATCH /products/:id that changes a field;
 *  - fulkruma.product.archived.v1 / fulkruma.variant.archived.v1 — once, on archive;
 *  - fulkruma.variant.created.v1 — POST /products/:id/variants;
 *  - fulkruma.delivery.downloaded.v1 — POST /deliveries/:id/download, counted against
 *    maxDownloads (409 at the limit, 410 once expired);
 *  - fulkruma.delivery.expired.v1 — the expiry sweep, once per expiry; extending a
 *    delivery makes its next expiry announced again;
 *  - fulkruma.license.activated.v1 / .deactivated.v1 — on a real change only.
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
const { default: productsRouter } = await import('../routes/products.js');
const { default: deliveriesRouter } = await import('../routes/deliveries.js');
const { notifyExpiredDeliveries } = await import('../services/delivery-expiry.js');
const { default: licensesRouter } = await import('../routes/licenses.js');

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/v1/products', productsRouter);
  a.use('/api/v1/deliveries', deliveriesRouter);
  return a;
}

const run = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const accounts: string[] = [];
function account(tag: string) {
  const id = `acc_cattest_${run}_${tag}`;
  accounts.push(id);
  return id;
}

const events = (accountId: string, type: string) =>
  prisma.outboxEvent.findMany({ where: { accountId, type }, orderBy: { createdAt: 'asc' } });

async function product(acc: string) {
  const res = await request(app()).post('/api/v1/products').set('x-test-account', acc)
    .send({ name: 'Ebook', sku: 'EB-1', type: 'digital' }).expect(201);
  return res.body.data.product as { id: string; variants: { id: string }[] };
}

async function delivery(acc: string, extra: Record<string, unknown> = {}) {
  const res = await request(app()).post('/api/v1/deliveries').set('x-test-account', acc).send({
    productId: 'prod_x', customerId: 'cus_x', checkoutSessionId: `cs_${run}_${crypto.randomBytes(4).toString('hex')}`, ...extra,
  }).expect(201);
  return res.body.data.delivery as { id: string };
}

describe.skipIf(!HAS_DB)('catalog events (real database)', () => {
  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { accountId: { in: accounts } } });
    await prisma.delivery.deleteMany({ where: { accountId: { in: accounts } } });
    await prisma.product.deleteMany({ where: { accountId: { in: accounts } } });
    await prisma.$disconnect();
  });

  it('product.updated fires when a field changes, not for a no-op patch', async () => {
    const acc = account('pupd');
    const p = await product(acc);
    await request(app()).patch(`/api/v1/products/${p.id}`).set('x-test-account', acc).send({ name: 'Ebook 2e', sku: 'EB-1' }).expect(200);
    await request(app()).patch(`/api/v1/products/${p.id}`).set('x-test-account', acc).send({ name: 'Ebook 2e' }).expect(200);
    const ev = await events(acc, 'fulkruma.product.updated.v1');
    expect(ev).toHaveLength(1);
    expect(ev[0]!.data).toMatchObject({ productId: p.id, name: 'Ebook 2e', sku: 'EB-1', type: 'digital', changed: ['name'] });
  });

  it('product.archived and variant.archived fire once; variant.created on create', async () => {
    const acc = account('parch');
    const p = await product(acc);
    const v = await request(app()).post(`/api/v1/products/${p.id}/variants`).set('x-test-account', acc)
      .send({ name: 'PDF', sku: 'EB-1-PDF', priceCents: 50000 }).expect(201);
    const created = await events(acc, 'fulkruma.variant.created.v1');
    expect(created).toHaveLength(1);
    expect(created[0]!.data).toMatchObject({ variantId: v.body.data.variant.id, productId: p.id, name: 'PDF', sku: 'EB-1-PDF', priceCents: 50000 });

    await request(app()).delete(`/api/v1/products/${p.id}/variants/${v.body.data.variant.id}`).set('x-test-account', acc).expect(200);
    await request(app()).delete(`/api/v1/products/${p.id}/variants/${v.body.data.variant.id}`).set('x-test-account', acc).expect(200);
    expect(await events(acc, 'fulkruma.variant.archived.v1')).toHaveLength(1);

    await request(app()).delete(`/api/v1/products/${p.id}`).set('x-test-account', acc).expect(200);
    await request(app()).delete(`/api/v1/products/${p.id}`).set('x-test-account', acc).expect(200);
    const archived = await events(acc, 'fulkruma.product.archived.v1');
    expect(archived).toHaveLength(1);
    expect(archived[0]!.data).toMatchObject({ productId: p.id, name: 'Ebook', type: 'digital' });
  });

  it('a recorded download counts, emits delivery.downloaded, and stops at maxDownloads', async () => {
    const acc = account('dl');
    const d = await delivery(acc, { maxDownloads: 2 });
    const one = await request(app()).post(`/api/v1/deliveries/${d.id}/download`).set('x-test-account', acc).expect(200);
    expect(one.body.data.delivery.downloadCount).toBe(1);
    await request(app()).post(`/api/v1/deliveries/${d.id}/download`).set('x-test-account', acc).expect(200);
    const third = await request(app()).post(`/api/v1/deliveries/${d.id}/download`).set('x-test-account', acc).expect(409);
    expect(third.body.error.code).toBe('DOWNLOAD_LIMIT');
    const ev = await events(acc, 'fulkruma.delivery.downloaded.v1');
    expect(ev.map((e) => (e.data as any).downloadCount)).toEqual([1, 2]);
    expect(ev[1]!.data).toMatchObject({ deliveryId: d.id, maxDownloads: 2, remaining: 0 });

    // Another account cannot record a download of it.
    await request(app()).post(`/api/v1/deliveries/${d.id}/download`).set('x-test-account', account('other')).expect(404);
  });

  it('two downloads at once never take the last one twice', async () => {
    const acc = account('race');
    const d = await delivery(acc, { maxDownloads: 1 });
    const results = await Promise.all([1, 2, 3].map(() => request(app()).post(`/api/v1/deliveries/${d.id}/download`).set('x-test-account', acc)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await events(acc, 'fulkruma.delivery.downloaded.v1')).toHaveLength(1);
  });

  it('delivery.expired once per expiry: revoke, sweep, sweep again, extend, expire again', async () => {
    const acc = account('exp');
    const d = await delivery(acc);
    await request(app()).post(`/api/v1/deliveries/${d.id}/revoke`).set('x-test-account', acc).expect(200);
    const gone = await request(app()).post(`/api/v1/deliveries/${d.id}/download`).set('x-test-account', acc).expect(410);
    expect(gone.body.error.code).toBe('EXPIRED');

    await notifyExpiredDeliveries(new Date(Date.now() + 1000), { accountId: acc });
    await notifyExpiredDeliveries(new Date(Date.now() + 2000), { accountId: acc });
    let expired = await events(acc, 'fulkruma.delivery.expired.v1');
    expect(expired).toHaveLength(1);
    expect(expired[0]!.data).toMatchObject({ deliveryId: d.id, productId: 'prod_x', customerId: 'cus_x' });

    await request(app()).post(`/api/v1/deliveries/${d.id}/extend`).set('x-test-account', acc).expect(200);
    await notifyExpiredDeliveries(new Date(Date.now() + 2000), { accountId: acc }); // still in its new window
    expect(await events(acc, 'fulkruma.delivery.expired.v1')).toHaveLength(1);
    await notifyExpiredDeliveries(new Date(Date.now() + 31 * 24 * 3600 * 1000), { accountId: acc });
    expired = await events(acc, 'fulkruma.delivery.expired.v1');
    expect(expired).toHaveLength(2);
  });
});

describe.skipIf(!HAS_DB)('license activation events (real database)', () => {
  function lapp() {
    const a = express();
    a.use(express.json());
    a.use('/api/v1/licenses', licensesRouter);
    return a;
  }

  it('activated / deactivated fire on real changes only; a deactivated instance can activate again; the cap is a 409', async () => {
    const acc = account('lic');
    const lic = await prisma.license.create({
      data: { accountId: acc, productId: 'prod_x', customerId: 'cus_x', key: `LIC-${run}-${crypto.randomBytes(3).toString('hex')}`, maxActivations: 1 },
    });
    const act = (instanceId: string) => request(lapp()).post('/api/v1/licenses/activate').send({ key: lic.key, instanceId });
    const deact = (instanceId: string) => request(lapp()).post('/api/v1/licenses/deactivate').send({ key: lic.key, instanceId });

    expect((await act('laptop')).status).toBe(200);
    expect((await act('laptop')).body.data.alreadyActive).toBe(true); // no event
    const capped = await act('desktop');
    expect(capped.status).toBe(409);
    expect(capped.body.error.code).toBe('MAX_ACTIVATIONS');
    expect((await deact('laptop')).status).toBe(200);
    expect((await deact('laptop')).body.data.alreadyDeactivated).toBe(true); // no event
    const again = await act('laptop');
    expect(again.status).toBe(200);
    expect(again.body.data.alreadyActive).toBe(false);

    const activated = await events(acc, 'fulkruma.license.activated.v1');
    expect(activated.map((e) => (e.data as any).instanceId)).toEqual(['laptop', 'laptop']);
    expect(activated[1]!.data).toMatchObject({ licenseId: lic.id, activations: 1, maxActivations: 1 });
    const deactivated = await events(acc, 'fulkruma.license.deactivated.v1');
    expect(deactivated).toHaveLength(1);
    expect(deactivated[0]!.data).toMatchObject({ licenseId: lic.id, instanceId: 'laptop', activations: 0 });
    expect((await prisma.license.findUniqueOrThrow({ where: { id: lic.id } })).activations).toBe(1);
    await prisma.license.delete({ where: { id: lic.id } });
  });
});
