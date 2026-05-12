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

describe('webhooks', () => {
  it('endpoints list calls webhooks.listEndpoints', async () => {
    fake.on('webhooks.listEndpoints', { endpoints: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['webhooks', 'endpoints', 'list']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.method === 'listEndpoints')).toBe(true);
  });

  it('endpoints create forwards url + events', async () => {
    fake.on('webhooks.createEndpoint', { endpoint: { id: 'we_1' } });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, [
        'webhooks',
        'endpoints',
        'create',
        '--url',
        'https://x.test/hook',
        '--events',
        'shipment.created,license.issued',
      ]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'createEndpoint');
    expect(call!.args[0]).toEqual({
      url: 'https://x.test/hook',
      events: ['shipment.created', 'license.issued'],
      description: undefined,
    });
  });

  it('endpoints update forwards id + patch', async () => {
    fake.on('webhooks.updateEndpoint', { endpoint: { id: 'we_1' } });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['webhooks', 'endpoints', 'update', 'we_1', '--active', 'false']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'updateEndpoint');
    expect(call!.args[0]).toBe('we_1');
    expect(call!.args[1]).toEqual({ active: false });
  });

  it('endpoints delete calls webhooks.deleteEndpoint', async () => {
    fake.on('webhooks.deleteEndpoint', { deleted: true });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['webhooks', 'endpoints', 'delete', 'we_1']);
    } finally {
      s.restore();
    }
    expect(fake.calls.find((c) => c.method === 'deleteEndpoint')!.args).toEqual(['we_1']);
  });

  it('events list calls webhooks.listEvents', async () => {
    fake.on('webhooks.listEvents', { events: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['webhooks', 'events', 'list', '--type', 'shipment.created']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'listEvents');
    expect(call!.args[0]).toMatchObject({ type: 'shipment.created' });
  });
});
