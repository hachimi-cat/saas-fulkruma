// S-046: per-merchant prepaid shipping credit + ledger. Single
// source of truth for "can this merchant book a courier?". Charge
// + refund + topup + adjust all flow through this module so the
// balance + ledger stay in sync via a single $transaction.
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';

export type ShippingCreditTransactionKind =
  | 'topup'
  | 'shipment_charge'
  | 'shipment_refund'
  | 'manual_adjustment';

export interface ShippingCreditBalance {
  accountId: string;
  balance: number;
  updatedAt: string;
}

export class InsufficientShippingCreditError extends Error {
  constructor(public readonly required: number, public readonly available: number) {
    super(`Insufficient shipping credit: required ${required}, available ${available}`);
    this.name = 'InsufficientShippingCreditError';
  }
}

/** Get the balance, creating the row lazily at 0 if absent. */
export async function getBalance(accountId: string): Promise<ShippingCreditBalance> {
  const row = await prisma.shippingCredit.upsert({
    where: { accountId },
    create: { accountId, balance: 0 },
    update: {},
  });
  return {
    accountId: row.accountId,
    balance: row.balance,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** List recent ledger entries for the merchant. */
export async function listTransactions(
  accountId: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<{
  data: Array<{
    id: string;
    kind: ShippingCreditTransactionKind;
    amount: number;
    balanceAfter: number;
    shipmentId: string | null;
    externalRef: string | null;
    memo: string | null;
    createdAt: string;
  }>;
  nextCursor: string | null;
}> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const rows = await prisma.shippingCreditTransaction.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit);
  return {
    data: slice.map((r) => ({
      id: r.id,
      kind: r.kind as ShippingCreditTransactionKind,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      shipmentId: r.shipmentId,
      externalRef: r.externalRef,
      memo: r.memo,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null,
  };
}

interface AdjustInput {
  accountId: string;
  /** Signed amount in IDR — positive credits, negative debits. */
  amount: number;
  kind: ShippingCreditTransactionKind;
  shipmentId?: string | null;
  externalRef?: string | null;
  memo?: string | null;
  /** Override the FK row if running inside an existing transaction. */
  tx?: Prisma.TransactionClient;
}

/**
 * Apply a balance change + write a ledger entry atomically.
 *
 * For `shipment_charge` (negative amount), if the resulting balance
 * would go below zero, throws InsufficientShippingCreditError WITHOUT
 * writing anything. All other kinds are unconditional — manual_
 * adjustment can produce a negative balance if ops needs that.
 */
export async function applyTransaction(input: AdjustInput): Promise<ShippingCreditBalance> {
  const run = async (tx: Prisma.TransactionClient): Promise<ShippingCreditBalance> => {
    // Lazy-create the credit row at 0 inside the same txn so the
    // balance update below operates on a known row.
    await tx.shippingCredit.upsert({
      where: { accountId: input.accountId },
      create: { accountId: input.accountId, balance: 0 },
      update: {},
    });
    const current = await tx.shippingCredit.findUnique({
      where: { accountId: input.accountId },
      select: { balance: true },
    });
    const before = current?.balance ?? 0;
    const after = before + input.amount;
    if (input.kind === 'shipment_charge' && after < 0) {
      throw new InsufficientShippingCreditError(Math.abs(input.amount), before);
    }
    const updated = await tx.shippingCredit.update({
      where: { accountId: input.accountId },
      data: { balance: after },
    });
    await tx.shippingCreditTransaction.create({
      data: {
        accountId: input.accountId,
        kind: input.kind,
        amount: input.amount,
        balanceAfter: after,
        shipmentId: input.shipmentId ?? null,
        externalRef: input.externalRef ?? null,
        memo: input.memo ?? null,
      },
    });
    return {
      accountId: updated.accountId,
      balance: updated.balance,
      updatedAt: updated.updatedAt.toISOString(),
    };
  };
  // Reuse caller's txn if provided so confirmPickup can wrap both
  // the Biteship call + the debit in one atomic boundary.
  if (input.tx) return run(input.tx);
  return prisma.$transaction(run);
}
