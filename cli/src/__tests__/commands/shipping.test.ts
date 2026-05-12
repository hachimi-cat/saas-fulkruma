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

describe('shipping', () => {
  it('couriers calls shipping.couriers', async () => {
    fake.on('shipping.couriers', []);
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipping', 'couriers']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.group === 'shipping' && c.method === 'couriers')).toBe(true);
  });

  it('origin calls shipping.origin', async () => {
    fake.on('shipping.origin', {});
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipping', 'origin']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.method === 'origin')).toBe(true);
  });

  it('set-origin forwards parsed body', async () => {
    fake.on('shipping.setOrigin', {});
    const s = silenceStdio();
    try {
      await runCli(buildProgram, [
        'shipping',
        'set-origin',
        '--body',
        JSON.stringify({ city: 'Jakarta', postalCode: '10110' }),
      ]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'setOrigin');
    expect(call!.args[0]).toEqual({ city: 'Jakarta', postalCode: '10110' });
  });

  it('rates forwards parsed body', async () => {
    fake.on('shipping.rates', {});
    const body = JSON.stringify({
      destination: { areaId: 'IDN-JKT' },
      items: [{ weight: 200 }],
      insurance: false,
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipping', 'rates', '--body', body]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'rates');
    expect(call!.args[0]).toMatchObject({ insurance: false });
  });
});
