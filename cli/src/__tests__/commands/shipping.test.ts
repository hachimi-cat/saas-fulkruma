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

  // ─── Advanced shipping passthrough routes ────

  it('config get → GET /api/v1/shipping/config via client.request', async () => {
    fake.on('client.request', { config: {} });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipping', 'config', 'get']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'client' && c.method === 'request');
    expect(call).toBeDefined();
    expect(call!.args[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/shipping/config',
    });
  });

  it('config update → PUT /api/v1/shipping/config with body', async () => {
    fake.on('client.request', { config: { courierKey: 'k' } });
    const body = JSON.stringify({ courierKey: 'k' });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipping', 'config', 'update', '--body', body]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'client' && c.method === 'request');
    expect(call!.args[0]).toMatchObject({
      method: 'PUT',
      path: '/api/v1/shipping/config',
      body: { courierKey: 'k' },
    });
  });

  it('track <waybill> → GET /api/v1/shipping/track/:waybill', async () => {
    fake.on('client.request', { status: 'in_transit' });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipping', 'track', 'JNE12345']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'client' && c.method === 'request');
    expect(call!.args[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/shipping/track/JNE12345',
    });
  });

  it('label <id> prints URL when response has one', async () => {
    fake.on('client.request', { url: 'https://labels.example.test/abc.pdf' });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipping', 'label', 'shp_1']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'client' && c.method === 'request');
    expect(call!.args[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/shipping/shipments/shp_1/label',
    });
  });

  it('cancel <id> → POST cancel with reason in body', async () => {
    fake.on('client.request', { ok: true });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, [
        'shipping',
        'cancel',
        'shp_1',
        '--reason',
        'customer changed mind',
      ]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'client' && c.method === 'request');
    expect(call!.args[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/shipping/shipments/shp_1/cancel',
      body: { reason: 'customer changed mind' },
    });
  });

  it('areas with --keyword → GET /api/v1/shipping/areas?keyword=...', async () => {
    fake.on('client.request', { areas: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['shipping', 'areas', '--keyword', 'jakarta']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'client' && c.method === 'request');
    expect(call!.args[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/shipping/areas?keyword=jakarta',
    });
  });
});
