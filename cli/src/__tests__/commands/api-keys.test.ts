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

describe('api-keys', () => {
  it('list calls apiKeys.list', async () => {
    fake.on('apiKeys.list', { keys: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['api-keys', 'list']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.group === 'apiKeys' && c.method === 'list')).toBe(true);
  });

  it('create forwards description', async () => {
    fake.on('apiKeys.create', { key: { id: 'k_1', keyId: 'AKIA', secret: 'x' } });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['api-keys', 'create', '--description', 'CI']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'create');
    expect(call!.args[0]).toMatchObject({ description: 'CI' });
  });

  it('revoke <id> calls apiKeys.revoke', async () => {
    fake.on('apiKeys.revoke', { revoked: true });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['api-keys', 'revoke', 'k_1']);
    } finally {
      s.restore();
    }
    expect(fake.calls.find((c) => c.method === 'revoke')!.args).toEqual(['k_1']);
  });
});
