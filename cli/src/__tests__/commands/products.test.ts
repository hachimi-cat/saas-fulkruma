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

describe('products', () => {
  it('list calls products.list with no args by default', async () => {
    fake.on('products.list', { products: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['products', 'list']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'products' && c.method === 'list');
    expect(call).toBeDefined();
    expect(call!.args[0]).toBeUndefined();
  });

  it('list --archived forwards { archived: true }', async () => {
    fake.on('products.list', { products: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['products', 'list', '--archived']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'products' && c.method === 'list');
    expect(call!.args[0]).toEqual({ archived: true });
  });

  it('get <id> calls products.get with id', async () => {
    fake.on('products.get', {
      product: {
        id: 'p_1',
        accountId: 'acc',
        name: 'X',
        sku: null,
        description: null,
        type: 'physical',
        weight: null,
        length: null,
        width: null,
        height: null,
        licenseEnabled: false,
        maxActivations: 0,
        externalRef: null,
        externalSource: null,
        archived: false,
        metadata: {},
        createdAt: '',
        updatedAt: '',
      },
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['products', 'get', 'p_1']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'products' && c.method === 'get');
    expect(call!.args).toEqual(['p_1']);
  });

  it('create passes name + type', async () => {
    fake.on('products.create', {
      product: {
        id: 'p_2',
        accountId: 'acc',
        name: 'Hoodie',
        sku: null,
        description: null,
        type: 'physical',
        weight: null,
        length: null,
        width: null,
        height: null,
        licenseEnabled: false,
        maxActivations: 0,
        externalRef: null,
        externalSource: null,
        archived: false,
        metadata: {},
        createdAt: '',
        updatedAt: '',
      },
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['products', 'create', '--name', 'Hoodie', '--type', 'physical']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'products' && c.method === 'create');
    expect((call!.args[0] as Record<string, unknown>)['name']).toBe('Hoodie');
    expect((call!.args[0] as Record<string, unknown>)['type']).toBe('physical');
  });

  it('update sends only provided fields', async () => {
    fake.on('products.update', {
      product: {
        id: 'p_2',
        accountId: 'acc',
        name: 'Hoodie',
        sku: 'HD-1',
        description: null,
        type: 'physical',
        weight: null,
        length: null,
        width: null,
        height: null,
        licenseEnabled: false,
        maxActivations: 0,
        externalRef: null,
        externalSource: null,
        archived: false,
        metadata: {},
        createdAt: '',
        updatedAt: '',
      },
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['products', 'update', 'p_2', '--sku', 'HD-1']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'products' && c.method === 'update');
    expect(call!.args[0]).toBe('p_2');
    expect(call!.args[1]).toEqual({ sku: 'HD-1' });
  });

  it('archive sends id', async () => {
    fake.on('products.archive', { archived: true });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['products', 'archive', 'p_2']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'products' && c.method === 'archive');
    expect(call!.args).toEqual(['p_2']);
  });
});
