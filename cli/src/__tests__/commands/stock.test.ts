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

describe('stock', () => {
  it('levels calls stock.levels', async () => {
    fake.on('stock.levels', { stock: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['stock', 'levels']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.group === 'stock' && c.method === 'levels')).toBe(true);
  });

  it('levels --variant-id forwards as snake_case', async () => {
    fake.on('stock.levels', { stock: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['stock', 'levels', '--variant-id', 'v_1']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'stock' && c.method === 'levels');
    expect(call!.args[0]).toEqual({ variant_id: 'v_1' });
  });

  it('movements --variant-id forwards as snake_case', async () => {
    fake.on('stock.movements', { movements: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['stock', 'movements', '--variant-id', 'v_1']);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'stock' && c.method === 'movements');
    expect(call!.args[0]).toEqual({ variant_id: 'v_1' });
  });

  it('reservations calls stock.reservations', async () => {
    fake.on('stock.reservations', { reservations: [] });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, ['stock', 'reservations']);
    } finally {
      s.restore();
    }
    expect(fake.calls.some((c) => c.method === 'reservations')).toBe(true);
  });

  it('adjust passes all positional args + reason', async () => {
    fake.on('stock.adjust', {
      stock: { id: 's_1', variantId: 'v_1', warehouseId: 'w_1', quantity: 105, updatedAt: '' },
      movement: { id: 'm_1', variantId: 'v_1', warehouseId: 'w_1', delta: 5, reason: 'initial_stock', referenceId: null, note: null, createdAt: '', createdBy: null },
    });
    const s = silenceStdio();
    try {
      await runCli(buildProgram, [
        'stock',
        'adjust',
        'v_1',
        'w_1',
        '5',
        '--reason',
        'initial_stock',
        '--note',
        'first run',
      ]);
    } finally {
      s.restore();
    }
    const call = fake.calls.find((c) => c.group === 'stock' && c.method === 'adjust');
    expect(call!.args[0]).toEqual({
      variantId: 'v_1',
      warehouseId: 'w_1',
      delta: 5,
      reason: 'initial_stock',
      note: 'first run',
    });
  });
});
