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

describe('stats', () => {
  it('overview calls stats.overview', async () => {
    fake.on('stats.overview', { counters: {}, recent: {} });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['stats', 'overview']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.group === 'stats' && c.method === 'overview')).toBe(true);
  });
});
