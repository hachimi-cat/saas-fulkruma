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

describe('addresses', () => {
  it('list calls addresses.list', async () => {
    fake.on('addresses.list', { addresses: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['addresses', 'list']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.group === 'addresses' && c.method === 'list')).toBe(true);
  });

  it('list --customer-id forwards as snake_case', async () => {
    fake.on('addresses.list', { addresses: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['addresses', 'list', '--customer-id', 'c_1']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'addresses' && c.method === 'list');
    expect(call!.args[0]).toEqual({ customer_id: 'c_1' });
  });

  it('create passes required + optional fields', async () => {
    fake.on('addresses.create', {
      address: {
        id: 'a_1',
        customerId: 'c_1',
        accountId: 'acc',
        label: 'Home',
        contactName: 'Adi',
        contactPhone: '+62',
        email: null,
        address: 'Jl',
        postalCode: null,
        areaId: null,
        lat: null,
        lng: null,
        biteshipLocationId: null,
        isDefault: false,
        createdAt: '',
        updatedAt: '',
      },
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, [
        'addresses',
        'create',
        '--customer-id',
        'c_1',
        '--label',
        'Home',
        '--contact-name',
        'Adi',
        '--contact-phone',
        '+62',
        '--address',
        'Jl',
      ]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'addresses' && c.method === 'create');
    expect(call!.args[0]).toMatchObject({
      customerId: 'c_1',
      label: 'Home',
      contactName: 'Adi',
      contactPhone: '+62',
      address: 'Jl',
    });
  });

  it('delete <id> calls addresses.delete', async () => {
    fake.on('addresses.delete', { deleted: true });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['addresses', 'delete', 'a_1']);
    } finally {
      s.restore();
    }
    expect(fake.calls.find((c) => c.method === 'delete')!.args).toEqual(['a_1']);
  });
});
