import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { prisma } from '../lib/db.js';

/*
 * GET /api/v1/admin/transactions — the admin-portal standard's Transactions
 * contract (`AdminTransactionList` in @forjio/admin-ui).
 *
 * THIS PAGE IS THE ITEMISATION OF THE BUSINESS-METRICS TILE. Same table,
 * same filter, same window as the `transactions` slice of
 * admin-metrics.ts. If the two ever disagree an operator has no way to
 * tell which one is lying, so they are deliberately written to the same
 * definition — fulkruma's OWN subscription revenue.
 *
 * The summary is aggregated over the whole WINDOW, not over the rows on
 * screen: a busy month past the row cap must still report what it took.
 */

const rid = (req: { requestId?: string }) => req.requestId ?? 'req_unknown';

const router = Router();

/** Only money that ARRIVED. Keyed on when it arrived, too: an invoice
 *  raised in one month and settled the next belongs to the month of the
 *  payment, which is the month a bank statement will agree with. */
const PAID = 'paid';

const RUPIAH_TO_MINOR = 100;

const MAX_ROWS = 500;

function clampDays(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : 30;
  // Clamped rather than rejected: a silly `?days=100000` should give an
  // operator a year of data, not a validation error.
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), 365) : 30;
}

router.get('/', async (req, res) => {
  const days = clampDays(req.query.days);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const where = { status: PAID, paidAt: { gte: from, lte: to } };

  try {
    const [rows, agg, payers] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        take: MAX_ROWS,
        select: {
          id: true,
          accountId: true,
          amount: true,
          currency: true,
          paidAt: true,
          plan: true,
          plugipayInvoiceId: true,
        },
      }),
      // Over the WINDOW, not over `rows` — see the header.
      prisma.invoice.aggregate({ where, _count: { _all: true }, _sum: { amount: true } }),
      prisma.invoice
        .findMany({ where, distinct: ['accountId'], select: { accountId: true } })
        .then((r) => r.length),
    ]);

    const payload = {
      rows: rows.map((r) => ({
        id: r.id,
        at: (r.paidAt ?? to).toISOString(),
        // The account that paid US. Its own customers' identities are a
        // different thing entirely and do not belong on this page.
        customer: r.accountId,
        kind: 'payment',
        amountMinor: r.amount * RUPIAH_TO_MINOR,
        // The row's OWN currency, never the summary's — a USD invoice
        // rendered as rupiah is off by a factor of sixteen thousand.
        currency: r.currency,
        status: 'paid',
        description: `${r.plan} plan · ${r.plugipayInvoiceId}`,
      })),
      summary: {
        count: agg._count?._all ?? 0,
        grossMinor: (agg._sum?.amount ?? 0) * RUPIAH_TO_MINOR,
        currency: 'IDR',
        payers,
      },
    };
    return res.json(ok(payload, rid(req)));
  } catch (e) {
    return res.status(500).json(err('TRANSACTIONS_FAILED', (e as Error).message, rid(req)));
  }
});

export default router;
