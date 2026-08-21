import { beforeEach, describe, expect, it, vi } from 'vitest';

// shipping-credit-service reaches for the real prisma singleton, so stub
// it out — the ledger write is asserted through this spy instead.
const applyTransaction = vi.hoisted(() => vi.fn(async () => ({ accountId: 'acc_1', balance: 0, updatedAt: '' })));
vi.mock('../services/shipping-credit-service.js', () => ({
  applyTransaction,
  InsufficientShippingCreditError: class extends Error {},
}));

const { cancelShipment, rebookShipment, ShipmentStateError } = await import('../services/shipping-service.js');
const { isCancellable, isRebookable } = await import('../lib/shipment-status.js');

// ─── Minimal in-memory prisma double ────────────────────────────────
// Only the four delegates the two services touch. Rows are plain
// objects so assertions can read them back directly.

function makeShipment(over: Record<string, unknown> = {}) {
  return {
    id: 'sh_dead',
    accountId: 'acc_1',
    productId: null,
    checkoutSessionId: null,
    customerId: null,
    customerEmail: 'buyer@example.com',
    biteshipDraftOrderId: 'draft_1',
    biteshipOrderId: 'ord_1',
    waybillId: 'JO0327373568',
    courierCode: 'jnt',
    courierServiceCode: 'ez',
    courierType: 'regular',
    status: 'picking_up',
    price: 40_000,
    insurance: 0,
    insured: false,
    refundedAt: null,
    refundedAmount: 0,
    replacesShipmentId: null,
    replacedByShipmentId: null,
    originSnapshot: { contactName: 'Cirengs', contactPhone: '0812', address: 'Jl. Asal 1' },
    destinationSnapshot: { contactName: 'Rani', contactPhone: '0813', address: 'Jl. Tujuan 8' },
    items: [{ name: 'Cireng', value: 50_000, weight: 600, quantity: 3 }],
    externalSource: 'storlaunch',
    externalRef: 'ord_abc',
    ...over,
  };
}

function makePrisma(rows: Array<Record<string, unknown>>) {
  const events: Array<Record<string, unknown>> = [];
  const outbox: Array<Record<string, unknown>> = [];
  let seq = 0;
  return {
    rows, events, outbox,
    biteshipConfig: { findUnique: async () => ({ apiKey: null }) },
    shipment: {
      findUnique: async ({ where }: never) => rows.find((r) => r.id === (where as { id: string }).id) ?? null,
      count: async () => rows.length,
      create: async ({ data }: never) => {
        const row = { id: `sh_new_${++seq}`, ...(data as object) } as Record<string, unknown>;
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: never) => {
        const row = rows.find((r) => r.id === (where as { id: string }).id)!;
        Object.assign(row, data as object);
        return row;
      },
      updateMany: async ({ where, data }: never) => {
        const w = where as Record<string, unknown>;
        const matched = rows.filter((r) => r.id === w.id && (!('refundedAt' in w) || r.refundedAt === w.refundedAt));
        matched.forEach((r) => Object.assign(r, data as object));
        return { count: matched.length };
      },
    },
    shipmentEvent: { create: async ({ data }: never) => { events.push(data as Record<string, unknown>); return data; } },
    outboxEvent: { create: async ({ data }: never) => { outbox.push(data as Record<string, unknown>); return data; } },
  } as never;
}

const adapter = () => ({
  cancelOrder: vi.fn(async (_id: string, _reason?: string) => ({ success: true })),
  deleteDraftOrder: vi.fn(async (_id: string) => ({ success: true })),
  createDraftOrder: vi.fn(async (params: { referenceId: string }) => ({ id: 'draft_new', status: 'placed' as const, reference_id: params.referenceId })),
});

beforeEach(() => applyTransaction.mockClear());

describe('cancel/rebook status gates', () => {
  it('lets a no-show pickup be cancelled but not rebooked', () => {
    // picking_up = driver en route to the merchant, parcel hasn't moved.
    expect(isCancellable('picking_up')).toBe(true);
    expect(isRebookable('picking_up')).toBe(false);
  });

  it('refuses to cancel once the courier has custody', () => {
    for (const s of ['picked_up', 'dropping_off', 'on_hold', 'return_in_transit', 'delivered']) {
      expect(isCancellable(s)).toBe(false);
      expect(isRebookable(s)).toBe(false);
    }
  });

  it('offers rebook exactly on the dead statuses', () => {
    for (const s of ['cancelled', 'rejected', 'courier_not_found', 'failed']) expect(isRebookable(s)).toBe(true);
    // A completed round trip must not re-dispatch the same parcel.
    for (const s of ['returned', 'disposed']) expect(isRebookable(s)).toBe(false);
  });
});

describe('cancelShipment', () => {
  it('refunds the full price when a confirmed booking is cancelled pre-pickup', async () => {
    const prisma = makePrisma([makeShipment()]);
    const ad = adapter();
    const res = await cancelShipment(prisma, 'sh_dead', 'Driver never came', ad as never);

    expect(ad.cancelOrder).toHaveBeenCalledWith('ord_1', 'Driver never came');
    expect(res.refunded).toBe(40_000);
    expect(res.shipment.status).toBe('cancelled');
    expect(applyTransaction).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'acc_1', amount: 40_000, kind: 'shipment_refund', shipmentId: 'sh_dead',
    }));
    expect((prisma as never as { outbox: Array<{ type: string }> }).outbox[0]!.type)
      .toBe('fulkruma.shipment.cancelled.v1');
  });

  it('does not refund an unconfirmed draft — it was never charged', async () => {
    const prisma = makePrisma([makeShipment({ status: 'pending', biteshipOrderId: null })]);
    const ad = adapter();
    const res = await cancelShipment(prisma, 'sh_dead', 'Changed mind', ad as never);

    expect(ad.deleteDraftOrder).toHaveBeenCalledWith('draft_1');
    expect(ad.cancelOrder).not.toHaveBeenCalled();
    expect(res.refunded).toBe(0);
    expect(applyTransaction).not.toHaveBeenCalled();
  });

  it('refunds at most once even if cancel is replayed', async () => {
    const rows = [makeShipment()];
    const prisma = makePrisma(rows);
    await cancelShipment(prisma, 'sh_dead', 'first', adapter() as never);
    // Force the row back to a cancellable status to simulate a racing
    // second call that got past the status gate.
    rows[0]!.status = 'picking_up';
    const second = await cancelShipment(prisma, 'sh_dead', 'second', adapter() as never);

    expect(second.refunded).toBe(0);
    expect(applyTransaction).toHaveBeenCalledTimes(1);
  });

  it('still cancels locally when Biteship rejects the call', async () => {
    const prisma = makePrisma([makeShipment()]);
    const ad = { ...adapter(), cancelOrder: vi.fn(async () => { throw new Error('order already dispatched'); }) };
    const res = await cancelShipment(prisma, 'sh_dead', 'Driver never came', ad as never);

    expect(res.shipment.status).toBe('cancelled');
    expect(res.courierError).toBe('order already dispatched');
    expect(res.refunded).toBe(40_000);
  });

  it('refuses a status the courier already owns', async () => {
    const prisma = makePrisma([makeShipment({ status: 'picked_up' })]);
    await expect(cancelShipment(prisma, 'sh_dead', 'too late', adapter() as never))
      .rejects.toBeInstanceOf(ShipmentStateError);
  });
});

describe('rebookShipment', () => {
  it('mints an unconfirmed replacement from the dead snapshots and links both rows', async () => {
    const rows = [makeShipment({ status: 'cancelled' })];
    const prisma = makePrisma(rows);
    const ad = adapter();
    const { shipment } = await rebookShipment(prisma, 'sh_dead', {}, ad as never);

    expect(shipment.replacesShipmentId).toBe('sh_dead');
    expect(rows[0]!.replacedByShipmentId).toBe(shipment.id);
    // Replacement starts as a draft — no order, no charge yet.
    expect(shipment.biteshipOrderId).toBeNull();
    expect(shipment.biteshipDraftOrderId).toBe('draft_new');
    expect(shipment.destinationSnapshot).toEqual(rows[0]!.destinationSnapshot);
    // Reference must not reuse the dead booking's — Biteship enforces
    // uniqueness across the merchant's whole account.
    expect(ad.createDraftOrder.mock.calls[0]?.[0]?.referenceId).not.toBe('ord_abc');
  });

  it('carries the old price only while the service is unchanged', async () => {
    const same = await rebookShipment(makePrisma([makeShipment({ status: 'cancelled' })]), 'sh_dead', {}, adapter() as never);
    expect(same.shipment.price).toBe(40_000);

    const switched = await rebookShipment(
      makePrisma([makeShipment({ status: 'cancelled' })]),
      'sh_dead',
      { courierCode: 'sicepat', courierServiceCode: 'reg' },
      adapter() as never,
    );
    // A different service costs a different amount; carrying 40k over
    // would debit the wrong number at confirm-pickup.
    expect(switched.shipment.price).toBe(0);
    expect(switched.shipment.courierCode).toBe('sicepat');
  });

  it('persists the replacement even when Biteship refuses the draft', async () => {
    const ad = { ...adapter(), createDraftOrder: vi.fn(async () => { throw new Error('Reference ID already taken'); }) };
    const { shipment, draftCreateError } = await rebookShipment(
      makePrisma([makeShipment({ status: 'cancelled' })]), 'sh_dead', {}, ad as never,
    );
    expect(draftCreateError).toBe('Reference ID already taken');
    expect(shipment.biteshipDraftOrderId).toBeNull();
  });

  it('refuses a second rebook of the same dead shipment', async () => {
    const prisma = makePrisma([makeShipment({ status: 'cancelled' })]);
    await rebookShipment(prisma, 'sh_dead', {}, adapter() as never);
    await expect(rebookShipment(prisma, 'sh_dead', {}, adapter() as never))
      .rejects.toBeInstanceOf(ShipmentStateError);
  });

  it('refuses to rebook something still in flight', async () => {
    const prisma = makePrisma([makeShipment({ status: 'picking_up' })]);
    await expect(rebookShipment(prisma, 'sh_dead', {}, adapter() as never))
      .rejects.toBeInstanceOf(ShipmentStateError);
  });

  it('rebooks a draft that never actually booked at Biteship', async () => {
    // pending + no draft id = create failed or the reference-id retries
    // were exhausted. Confirm-pickup 409s forever, so this needs a fresh
    // booking rather than a retry.
    const prisma = makePrisma([makeShipment({ status: 'pending', biteshipOrderId: null, biteshipDraftOrderId: null })]);
    const { shipment } = await rebookShipment(prisma, 'sh_dead', {}, adapter() as never);
    expect(shipment.biteshipDraftOrderId).toBe('draft_new');
  });

  it('leaves a healthy pending draft alone — that one just needs booking', async () => {
    const prisma = makePrisma([makeShipment({ status: 'pending', biteshipOrderId: null })]);
    await expect(rebookShipment(prisma, 'sh_dead', {}, adapter() as never))
      .rejects.toBeInstanceOf(ShipmentStateError);
  });
});
