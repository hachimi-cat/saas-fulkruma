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

describe('audit-log', () => {
  it('list calls auditLog.list with filter args', async () => {
    fake.on('auditLog.list', { entries: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, [
        'audit-log',
        'list',
        '--limit',
        '50',
        '--event-type',
        'shipment.created',
      ]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'list' && c.group === 'auditLog');
    expect(call!.args[0]).toMatchObject({ limit: 50, eventType: 'shipment.created' });
  });

  it('list forwards --action / --target-type / --created-after / --created-before', async () => {
    fake.on('auditLog.list', { entries: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, [
        'audit-log',
        'list',
        '--action',
        'product.archived',
        '--target-type',
        'Product',
        '--created-after',
        '2026-01-01T00:00:00Z',
        '--created-before',
        '2026-12-31T23:59:59Z',
      ]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'list' && c.group === 'auditLog');
    expect(call!.args[0]).toMatchObject({
      action: 'product.archived',
      targetType: 'Product',
      createdAfter: '2026-01-01T00:00:00Z',
      createdBefore: '2026-12-31T23:59:59Z',
    });
  });
});
