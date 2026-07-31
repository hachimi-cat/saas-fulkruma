import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { prisma } from '../lib/db.js';
import {
  collectBusinessMetrics,
  defaultWindow,
  type MetricsAdapter,
} from '../lib/business-metrics.js';

/*
 * GET /api/v1/admin/metrics?days=30 — fulkruma's business metrics.
 *
 * Mounted behind `adminGuard`; powers `BusinessMetricsPanel` and the
 * headline tiles on `AdminOverviewPanel`. Mandatory admin-portal standard.
 *
 * Fulkruma has a REAL invoice ledger (Plugipay-backed), so transactions
 * are genuine money movement rather than a derived MRR figure. Amounts
 * are whole RUPIAH; the contract carries MINOR units, hence x100.
 *
 * `Shipment.price` is the COURIER's fee that the merchant pays Biteship —
 * it is deliberately NOT counted as revenue here. Mixing pass-through
 * logistics cost into a revenue tile would overstate the business by
 * whatever volume happens to be moving.
 */

const RUPIAH_TO_MINOR = 100;

const adapter: MetricsAdapter = {
  workspaces: async ({ from }) => {
    const [total, active] = await Promise.all([
      prisma.subscription.count(),
      // "Active" = actually shipped something in the window. A configured
      // account that books no shipments is not an active logistics user.
      prisma.shipment
        .findMany({
          where: { createdAt: { gte: from } },
          distinct: ['accountId'],
          select: { accountId: true },
        })
        .then((r) => r.length),
    ]);
    return { total, active };
  },

  /**
   * Fulkruma has no roster table — it is a back-office service whose
   * tenants arrive through partner products (storlaunch, ripllo). The
   * honest count is distinct accounts holding a subscription; there is no
   * per-person identity in this bounded context to count instead.
   */
  workspaceMembers: async () => prisma.subscription.count(),

  transactions: async ({ from, to }) => {
    // paidAt, not createdAt: an invoice raised in one month and settled
    // the next belongs to the month the money arrived.
    const where = { status: 'paid', paidAt: { gte: from, lte: to } };
    const [agg, payers] = await Promise.all([
      prisma.invoice.aggregate({ where, _count: { _all: true }, _sum: { amount: true } }),
      prisma.invoice
        .findMany({ where, distinct: ['accountId'], select: { accountId: true } })
        .then((r) => r.length),
    ]);
    return {
      count: agg._count?._all ?? 0,
      grossMinor: (agg._sum?.amount ?? 0) * RUPIAH_TO_MINOR,
      currency: 'IDR',
      payers,
    };
  },

  series: async ({ from, to }) => {
    // Shipment volume per day plus settled invoice revenue. Grouped in
    // SQL because shipments is fulkruma's hot table.
    const rows = await prisma.$queryRaw<
      { day: Date; shipments: bigint; gross: bigint | null }[]
    >`
      SELECT d::date AS day,
             (SELECT COUNT(*) FROM "Shipment" s WHERE s."createdAt"::date = d::date) AS shipments,
             (SELECT SUM(i."amount") FROM "Invoice" i
               WHERE i."status" = 'paid' AND i."paidAt"::date = d::date) AS gross
      FROM generate_series(${from}::date, ${to}::date, '1 day') AS d
      ORDER BY 1
    `;
    return rows.map((r) => ({
      at: new Date(r.day).toISOString(),
      users: 0,
      transactions: Number(r.shipments),
      grossMinor: Number(r.gross ?? 0) * RUPIAH_TO_MINOR,
    }));
  },
};

const router = Router();
const rid = (req: { requestId?: string }) => req.requestId ?? 'req_unknown';

router.get('/', async (req, res) => {
  const raw = typeof req.query.days === 'string' ? Number(req.query.days) : 30;
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 365) : 30;
  try {
    return res.json(ok(await collectBusinessMetrics(adapter, defaultWindow(days)), rid(req)));
  } catch (e) {
    return res
      .status(500)
      .json(err('METRICS_COLLECT_FAILED', (e as Error).message, rid(req)));
  }
});

export default router;
