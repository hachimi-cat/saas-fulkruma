import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../../index.js';
import { installFakeClient, runCli, silenceStdio, type FakeClient } from '../helpers.js';
import { resetClientFactory } from '../../lib/client.js';

let fake: FakeClient;

const sampleLicense = {
  id: 'l_1',
  accountId: 'acc',
  productId: 'p_1',
  customerId: 'c_1',
  key: 'FK-XXXX',
  status: 'active' as const,
  activations: 0,
  maxActivations: 3,
  expiresAt: null,
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

describe('licenses', () => {
  it('list calls licenses.list', async () => {
    fake.on('licenses.list', { licenses: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['licenses', 'list']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.group === 'licenses' && c.method === 'list')).toBe(true);
  });

  it('issue forwards product + customer ids', async () => {
    fake.on('licenses.issue', { license: sampleLicense });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, [
        'licenses',
        'issue',
        '--product-id',
        'p_1',
        '--customer-id',
        'c_1',
        '--max-activations',
        '5',
      ]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'issue');
    expect(call!.args[0]).toMatchObject({
      productId: 'p_1',
      customerId: 'c_1',
      maxActivations: 5,
    });
  });

  it('revoke <id> calls licenses.revoke', async () => {
    fake.on('licenses.revoke', { license: sampleLicense });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['licenses', 'revoke', 'l_1']);
    } finally {
      s.restore();
    }
    expect(fake.calls.find((c) => c.method === 'revoke')!.args).toEqual(['l_1']);
  });

  it('validate <key> calls licenses.validate with key', async () => {
    fake.on('licenses.validate', {
      valid: true,
      key: 'FK-XXXX',
      status: 'active',
      productId: 'p_1',
      activations: 0,
      maxActivations: 3,
      expiresAt: null,
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['licenses', 'validate', 'FK-XXXX']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'validate');
    expect(call!.args[0]).toEqual({ key: 'FK-XXXX', productId: undefined });
  });

  it('activate <key> <instance> calls licenses.activate', async () => {
    fake.on('licenses.activate', {
      license: sampleLicense,
      activation: { id: 'a_1', licenseId: 'l_1', instanceId: 'inst-1', activatedAt: '', deactivatedAt: null },
      alreadyActive: false,
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['licenses', 'activate', 'FK-XXXX', 'inst-1']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'activate');
    expect(call!.args[0]).toEqual({ key: 'FK-XXXX', instanceId: 'inst-1' });
  });

  it('deactivate <key> <instance> calls licenses.deactivate', async () => {
    fake.on('licenses.deactivate', { deactivated: true, alreadyDeactivated: false, activations: 0 });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['licenses', 'deactivate', 'FK-XXXX', 'inst-1']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'deactivate');
    expect(call!.args[0]).toEqual({ key: 'FK-XXXX', instanceId: 'inst-1' });
  });
});
