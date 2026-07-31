import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { prisma } from '../lib/db.js';
import {
  fetchAppUsers,
  fetchAppStats,
  huudisAppConfigured,
} from '../lib/huudis-app.js';

/*
 * GET /api/v1/admin/customers — the admin-portal standard's Customers
 * contract (`AdminCustomer` in @forjio/admin-ui).
 *
 * This REPLACES the old passthrough, which returned the raw Huudis
 * `/app/users` roster and nothing else. A list of email addresses answers
 * "who signed in" and none of "is this merchant actually shipping",
 * which is what an operator opens the page for.
 *
 * ── fulkruma has no roster table ─────────────────────────────────────
 *
 * A Huudis identity meets an account via `AuditLog.actorId` where
 * actorType='user' — who has done something in a workspace. A merchant
 * who provisioned an account but never touched it has no audit rows and
 * shows as `no-activity` with dashes; fulkruma genuinely does not know
 * their account, and saying so beats inventing a join.
 *
 * ── REVENUE IS INVOICES, NOT SHIPMENT PRICE ──────────────────────────
 *
 * `Shipment.price` is the COURIER FEE fulkruma pays out on the
 * merchant's behalf — money leaving, not arriving. Reporting it as
 * revenue would turn fulkruma's largest cost into its headline figure.
 * Revenue is paid `Invoice.amount`: the subscription the merchant pays
 * fulkruma.
 */

const router = Router();

/** fulkruma's envelope helpers take the request id explicitly. Defined
 *  locally to match admin-metrics.ts rather than invented as a shared
 *  lib — one local const per route file is this product's idiom. */
const rid = (req: { requestId?: string }) => req.requestId ?? 'req_unknown';

const NEW_WINDOW_MS = 30 * 86_400_000;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

router.get('/', async (req, res) => {
  if (!huudisAppConfigured()) {
    return res
      .status(503)
      .json(
        err(
          'HUUDIS_NOT_CONFIGURED',
          'HUUDIS_CLIENT_ID / HUUDIS_CLIENT_SECRET must be set to list customers.',
          rid(req),
        ),
      );
  }
  try {
    const limitRaw = str(req.query.limit);
    const [page, stats] = await Promise.all([
      fetchAppUsers({
        q: str(req.query.q),
        status: str(req.query.status) as 'all' | 'active' | 'disabled' | undefined,
        limit: limitRaw ? Number(limitRaw) : 200,
        cursor: str(req.query.cursor),
      }),
      fetchAppStats().catch(() => null),
    ]);

    const subs = page.users.map((u) => u.id);

    const acted = subs.length
      ? await prisma.auditLog.groupBy({
          by: ['actorId', 'accountId'],
          where: { actorType: 'user', actorId: { in: subs } },
          _max: { createdAt: true },
        })
      : [];

    const accountsBySub = new Map<string, Set<string>>();
    const lastSeenBySub = new Map<string, Date>();
    for (const a of acted) {
      if (!a.actorId) continue;
      (accountsBySub.get(a.actorId) ?? accountsBySub.set(a.actorId, new Set()).get(a.actorId)!).add(
        a.accountId,
      );
      const at = a._max.createdAt;
      const prev = lastSeenBySub.get(a.actorId);
      if (at && (!prev || at > prev)) lastSeenBySub.set(a.actorId, at);
    }
    const accountIds = [...new Set([...accountsBySub.values()].flatMap((s) => [...s]))];

    const [shipments, invoices, subscriptions] = await Promise.all([
      accountIds.length
        ? prisma.shipment.groupBy({
            by: ['accountId'],
            where: { accountId: { in: accountIds } },
            _count: { _all: true },
            _max: { createdAt: true },
          })
        : [],
      accountIds.length
        ? prisma.invoice.groupBy({
            by: ['accountId'],
            // Paid only. An issued-but-unpaid invoice is a hope.
            where: { accountId: { in: accountIds }, paidAt: { not: null } },
            _sum: { amount: true },
            _count: { _all: true },
          })
        : [],
      accountIds.length
        ? prisma.subscription.findMany({
            where: { accountId: { in: accountIds } },
            select: { accountId: true, plan: true, status: true },
          })
        : [],
    ]);

    const shipmentsBy = new Map(shipments.map((r) => [r.accountId, r]));
    const invoicesBy = new Map(invoices.map((r) => [r.accountId, r]));
    const subBy = new Map(subscriptions.map((s) => [s.accountId, s]));

    const planRank: Record<string, number> = { FREE: 0, STARTER: 1, PRO: 2, BUSINESS: 3 };

    const now = Date.now();
    const customers = page.users.map((u) => {
      const accts = [...(accountsBySub.get(u.id) ?? [])];
      const shipped = accts.reduce((n, a) => n + (shipmentsBy.get(a)?._count._all ?? 0), 0);
      const paidIdr = accts.reduce((n, a) => n + (invoicesBy.get(a)?._sum.amount ?? 0), 0);
      const lastShipAt = accts
        .map((a) => shipmentsBy.get(a)?._max.createdAt)
        .filter((d): d is Date => !!d)
        .sort((x, y) => y.getTime() - x.getTime())[0];

      // The BEST plan they hold across their accounts — that is what they
      // are actually paying for.
      const plan =
        accts
          .map((a) => subBy.get(a)?.plan ?? 'FREE')
          .sort((x, y) => (planRank[y] ?? 0) - (planRank[x] ?? 0))[0] ?? 'FREE';

      const tags: string[] = [];
      if (u.disabled) tags.push('disabled');
      if (!u.emailVerified) tags.push('unverified');
      if (accts.length === 0) tags.push('no-activity');
      if (shipped > 0) tags.push('shipping');
      if (plan !== 'FREE') tags.push(String(plan).toLowerCase());
      if (now - new Date(u.firstSignInAt).getTime() < NEW_WINDOW_MS) tags.push('new');

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        status: u.disabled ? 'disabled' : 'active',
        signedUpAt: u.firstSignInAt,
        lastSeenAt: (lastSeenBySub.get(u.id) ?? new Date(u.lastSignInAt)).toISOString(),
        workspaceId: accts[0] ?? null,
        tags,
        metrics: [
          { label: 'Plan', value: String(plan).toLowerCase() },
          { label: 'Shipments', value: shipped.toLocaleString('en-GB') },
          {
            // Subscription revenue. NOT Shipment.price — see the header.
            label: 'Paid',
            value: paidIdr ? `Rp ${paidIdr.toLocaleString('id-ID')}` : '—',
          },
          {
            label: 'Last shipment',
            value: lastShipAt ? lastShipAt.toISOString().slice(0, 10) : '—',
          },
        ],
      };
    });

    return res.json(
      ok(
        {
          customers,
          total: stats?.users.total ?? customers.length,
        },
        rid(req),
      ),
    );
  } catch (e) {
    return res.status(502).json(err('CUSTOMERS_ERROR', (e as Error).message, rid(req)));
  }
});

export default router;
