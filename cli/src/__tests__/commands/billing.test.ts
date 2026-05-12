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

describe('billing', () => {
  it('plans calls billing.plans', async () => {
    fake.on('billing.plans', []);
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['billing', 'plans']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.method === 'plans')).toBe(true);
  });

  it('current-plan calls billing.currentPlan', async () => {
    fake.on('billing.currentPlan', {});
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['billing', 'current-plan']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.method === 'currentPlan')).toBe(true);
  });

  it('usage calls billing.usage', async () => {
    fake.on('billing.usage', {});
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['billing', 'usage']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.method === 'usage')).toBe(true);
  });

  it('invoices calls billing.invoices', async () => {
    fake.on('billing.invoices', { invoices: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['billing', 'invoices', '--limit', '10']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'invoices');
    expect(call!.args[0]).toMatchObject({ limit: 10 });
  });

  it('checkout <planId> calls billing.checkout', async () => {
    fake.on('billing.checkout', { url: 'https://pay', sessionId: 's_1' });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['billing', 'checkout', 'plan_pro']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.method === 'checkout');
    expect(call!.args[0]).toMatchObject({ planId: 'plan_pro' });
  });

  it('cancel calls billing.cancel', async () => {
    fake.on('billing.cancel', {});
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['billing', 'cancel']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.method === 'cancel')).toBe(true);
  });
});
