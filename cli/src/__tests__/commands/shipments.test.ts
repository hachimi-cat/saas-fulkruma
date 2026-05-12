import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../../index.js';
import { installFakeClient, runCli, silenceStdio, type FakeClient } from '../helpers.js';
import { resetClientFactory } from '../../lib/client.js';

let fake: FakeClient;

beforeEach(() => {
  process.env['FULKRUMA_KEY_ID'] = 'AKIA';
  process.env['FULKRUMA_SECRET'] = 'x';
  fake = installFakeClient();
});

afterEach(() => {
  resetClientFactory();
});

describe('shipments', () => {
  it('list calls shipments.list', async () => {
    fake.on('shipments.list', { shipments: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipments', 'list']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.group === 'shipments' && c.method === 'list')).toBe(true);
  });

  it('list --status filters', async () => {
    fake.on('shipments.list', { shipments: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipments', 'list', '--status', 'in_transit']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'shipments' && c.method === 'list');
    expect(call!.args[0]).toEqual({ status: 'in_transit' });
  });

  it('get <id> calls shipments.get', async () => {
    fake.on('shipments.get', {
      shipment: {
        id: 's_1',
        accountId: 'acc',
        productId: null,
        checkoutSessionId: null,
        customerId: null,
        customerEmail: null,
        biteshipOrderId: 'bs_1',
        biteshipTrackingId: null,
        waybillId: null,
        courierCode: 'jne',
        courierServiceCode: 'reg',
        courierType: 'standard',
        status: 'pending',
        trackingUrl: null,
        labelUrl: null,
        price: 10000,
        insurance: 0,
        insured: false,
        originSnapshot: {},
        destinationSnapshot: {},
        items: [],
        cancelReason: null,
        externalSource: null,
        externalRef: null,
        createdAt: '',
        updatedAt: '',
      },
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipments', 'get', 's_1']);
    } finally {
      s.restore();
    }
    expect(fake.calls.find((c) => c.method === 'get')!.args).toEqual(['s_1']);
  });

  it('create with --body forwards parsed JSON', async () => {
    fake.on('shipments.create', {
      shipment: {
        id: 's_2',
        accountId: 'acc',
        productId: null,
        checkoutSessionId: null,
        customerId: null,
        customerEmail: null,
        biteshipOrderId: 'bs_2',
        biteshipTrackingId: null,
        waybillId: null,
        courierCode: 'jne',
        courierServiceCode: 'reg',
        courierType: 'standard',
        status: 'pending',
        trackingUrl: null,
        labelUrl: null,
        price: 10000,
        insurance: 0,
        insured: false,
        originSnapshot: {},
        destinationSnapshot: {},
        items: [],
        cancelReason: null,
        externalSource: null,
        externalRef: null,
        createdAt: '',
        updatedAt: '',
      },
    });
    const body = JSON.stringify({
      courierCode: 'jne',
      courierServiceCode: 'reg',
      courierType: 'standard',
      price: 10000,
      origin: { addressId: 'o_1' },
      destination: { addressId: 'd_1' },
      items: [{ name: 'X', quantity: 1, value: 0, weight: 100 }],
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipments', 'create', '--body', body]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'shipments' && c.method === 'create');
    expect(call!.args[0]).toMatchObject({ courierCode: 'jne', price: 10000 });
  });
});
