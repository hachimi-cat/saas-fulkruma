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
    fake.on('apiKeys.list', { apiKeys: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['api-keys', 'list']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.group === 'apiKeys' && c.method === 'list')).toBe(true);
  });

  it('create sends the name and scopes the server takes', async () => {
    fake.on('apiKeys.create', { apiKey: { id: 'k_1', keyId: 'AKIA', name: 'CI', scopes: ['read'] }, secret: 'x' });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['api-keys', 'create', '--name', 'CI', '--scopes', 'read,write']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'create');
    expect(call!.args[0]).toEqual({ name: 'CI', scopes: ['read', 'write'] });
  });

  it('revoke <id> calls apiKeys.revoke', async () => {
    fake.on('apiKeys.revoke', { apiKey: { id: 'k_1', revokedAt: '2026-09-30T00:00:00Z' } });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['api-keys', 'revoke', 'k_1']);
    } finally {
      s.restore();
    }
    expect(fake.calls.find((c) => c.method === 'revoke')!.args).toEqual(['k_1']);
  });
});
