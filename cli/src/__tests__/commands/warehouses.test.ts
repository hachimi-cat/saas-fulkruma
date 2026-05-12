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

describe('warehouses', () => {
  it('list calls warehouses.list', async () => {
    fake.on('warehouses.list', { warehouses: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['warehouses', 'list']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.group === 'warehouses' && c.method === 'list')).toBe(true);
  });

  it('create passes name + optional flags', async () => {
    fake.on('warehouses.create', {
      warehouse: { id: 'w_1', accountId: 'a', name: 'JKT', address: null, city: 'Jakarta', postal: null, phone: null, isDefault: true, archived: false, createdAt: '', updatedAt: '' },
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['warehouses', 'create', '--name', 'JKT', '--city', 'Jakarta', '--default']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'warehouses' && c.method === 'create');
    expect(call!.args[0]).toMatchObject({ name: 'JKT', city: 'Jakarta', isDefault: true });
  });

  it('update sends only provided fields', async () => {
    fake.on('warehouses.update', {
      warehouse: { id: 'w_1', accountId: 'a', name: 'JKT', address: null, city: 'Jakarta', postal: '10110', phone: null, isDefault: false, archived: false, createdAt: '', updatedAt: '' },
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['warehouses', 'update', 'w_1', '--postal', '10110']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'warehouses' && c.method === 'update');
    expect(call!.args[0]).toBe('w_1');
    expect(call!.args[1]).toEqual({ postal: '10110' });
  });

  it('archive sends id', async () => {
    fake.on('warehouses.archive', { archived: true });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['warehouses', 'archive', 'w_1']);
    } finally {
      s.restore();
    }
    expect(fake.calls.find((c) => c.method === 'archive')!.args).toEqual(['w_1']);
  });
});
