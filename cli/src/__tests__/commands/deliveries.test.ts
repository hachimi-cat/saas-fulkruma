import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../../index.js';
import { installFakeClient, runCli, silenceStdio, type FakeClient } from '../helpers.js';
import { resetClientFactory } from '../../lib/client.js';

let fake: FakeClient;

const sampleDelivery = {
  id: 'd_1',
  accountId: 'acc',
  productId: 'p_1',
  customerId: 'c_1',
  checkoutSessionId: 'cs_1',
  downloadCount: 0,
  maxDownloads: 5,
  expiresAt: '',
  externalSource: null,
  externalRef: null,
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => {
  process.env['FULKRUMA_KEY_ID'] = 'AKIA';
  process.env['FULKRUMA_SECRET'] = 'x';
  fake = installFakeClient();
});

afterEach(() => {
  resetClientFactory();
});

describe('deliveries', () => {
  it('list calls deliveries.list', async () => {
    fake.on('deliveries.list', { deliveries: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['deliveries', 'list']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.group === 'deliveries' && c.method === 'list')).toBe(true);
  });

  it('get <id> calls deliveries.get', async () => {
    fake.on('deliveries.get', { delivery: sampleDelivery });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['deliveries', 'get', 'd_1']);
    } finally {
      s.restore();
    }
    expect(fake.calls.find((c) => c.method === 'get')!.args).toEqual(['d_1']);
  });

  it('create forwards required ids', async () => {
    fake.on('deliveries.create', { delivery: sampleDelivery });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, [
        'deliveries',
        'create',
        '--product-id',
        'p_1',
        '--customer-id',
        'c_1',
        '--checkout-session-id',
        'cs_1',
      ]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'create');
    expect(call!.args[0]).toMatchObject({
      productId: 'p_1',
      customerId: 'c_1',
      checkoutSessionId: 'cs_1',
    });
  });
});
