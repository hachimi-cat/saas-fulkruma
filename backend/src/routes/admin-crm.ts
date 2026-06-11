/**
 * Cross-product CRM endpoints for the centralized Forjio admin portal.
 *
 * Mounted at `/api/v1/admin/crm`, gated by `adminGuard` ALONE (no
 * `requireAuth` upstream — the portal authenticates with the
 * `X-Forjio-Admin-Secret` header only; see ../middleware/admin-guard.ts
 * path B). Mounted BEFORE the partner-billing `/admin` router in
 * index.ts so `requireAuth` there can't 401 the secret-only caller.
 *
 * Contract (shared by every Forjio product; the portal renders all
 * products through one generic client and parses `body.data ?? body`):
 *
 *   GET /stats         → { stats: [{ key, label, value, accent? }] }
 *   GET /customers     → { customers: [{ id, email, name, signupAt,
 *                          lastActiveAt, status, metrics }] }
 *   GET /transactions  → { summary: [{label, value}], rows: [...] }
 *
 * Read-only. Fulkruma is a shipping aggregator, so:
 *   - "customers"     = merchant accounts (Huudis workspace accountIds,
 *                       enriched from PartnerWorkspace / Subscription /
 *                       BiteshipConfig / ShippingCredit mirrors)
 *   - "transactions"  = shipments (waybills + cost) merged with the
 *                       prepaid shipping-credit ledger (topups/charges)
 */
import { Router } from 'express';
import { ok } from '@forjio/sdk/http';
import { prisma } from '../lib/db.js';

const router = Router();

// ── formatting helpers ──────────────────────────────────────────────

/** IDR whole units → "Rp 1.250.000" (Shipment.price + the credit ledger are whole Rupiah). */
function rupiah(idr: number): string {
  const sign = idr < 0 ? '-' : '';
  return `${sign}Rp ${Math.abs(Math.round(idr)).toLocaleString('id-ID')}`;
}

function num(n: number): string {
  return n.toLocaleString('id-ID');
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function pct(part: number, whole: number): string {
  if (whole === 0) return '—';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function maxDate(...ds: (Date | null | undefined)[]): Date | null {
  let out: Date | null = null;
  for (const d of ds) if (d && (!out || d > out)) out = d;
  return out;
}

function minDate(...ds: (Date | null | undefined)[]): Date | null {
  let out: Date | null = null;
  for (const d of ds) if (d && (!out || d < out)) out = d;
  return out;
}

// Terminal "successfully delivered" status.
const DELIVERED = 'delivered' as const;

// ── account directory ───────────────────────────────────────────────
// Fulkruma has no local User table (identity lives in Huudis); the
// merchant directory is the union of every accountId seen across the
// local mirrors. PartnerWorkspace carries brandName/businessEmail for
// partner-provisioned merchants; BiteshipConfig carries the shipping
// contact for direct merchants.

interface AccountInfo {
  accountId: string;
  email: string | null;
  name: string | null;
  signupAt: Date | null;
  status: string | null;
}

async function loadAccountDirectory(): Promise<Map<string, AccountInfo>> {
  const [partners, subs, biteship, credits] = await Promise.all([
    prisma.partnerWorkspace.findMany(),
    prisma.subscription.findMany(),
    prisma.biteshipConfig.findMany({
      select: { accountId: true, contactName: true, createdAt: true },
    }),
    prisma.shippingCredit.findMany({ select: { accountId: true, createdAt: true } }),
  ]);

  const dir = new Map<string, AccountInfo>();
  const ensure = (accountId: string): AccountInfo => {
    let info = dir.get(accountId);
    if (!info) {
      info = { accountId, email: null, name: null, signupAt: null, status: null };
      dir.set(accountId, info);
    }
    return info;
  };

  for (const p of partners) {
    const info = ensure(p.accountId);
    info.email = p.businessEmail ?? info.email;
    info.name = p.brandName ?? info.name;
    info.signupAt = minDate(info.signupAt, p.createdAt);
    info.status = `via ${p.partner}`;
  }
  for (const s of subs) {
    const info = ensure(s.accountId);
    info.signupAt = minDate(info.signupAt, s.createdAt);
    // Direct-tenant plan state wins over the partner tag when both exist.
    info.status = `${s.plan.toLowerCase()} / ${s.status.toLowerCase()}`;
  }
  for (const b of biteship) {
    const info = ensure(b.accountId);
    info.name = info.name ?? b.contactName ?? null;
    info.signupAt = minDate(info.signupAt, b.createdAt);
  }
  for (const c of credits) {
    const info = ensure(c.accountId);
    info.signupAt = minDate(info.signupAt, c.createdAt);
  }
  return dir;
}

function customerLabel(dir: Map<string, AccountInfo>, accountId: string | null): string | null {
  if (!accountId) return null;
  const info = dir.get(accountId);
  return info?.name ?? info?.email ?? accountId;
}

// ── GET /stats ──────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    dir,
    totalShipments,
    shipments30d,
    deliveredShipments,
    charges,
    creditOutstanding,
  ] = await Promise.all([
    loadAccountDirectory(),
    prisma.shipment.count(),
    prisma.shipment.count({ where: { createdAt: { gte: since30d } } }),
    prisma.shipment.count({ where: { status: DELIVERED } }),
    prisma.shippingCreditTransaction.aggregate({
      where: { kind: 'shipment_charge' },
      _sum: { amount: true },
    }),
    prisma.shippingCredit.aggregate({ _sum: { balance: true } }),
  ]);

  // Shipment accounts may predate any mirror row (e.g. partner flow
  // without a PartnerWorkspace yet) — count them in too.
  const shipmentAccounts = await prisma.shipment.groupBy({ by: ['accountId'] });
  const merchantIds = new Set<string>(dir.keys());
  for (const r of shipmentAccounts) merchantIds.add(r.accountId);

  const spend = Math.abs(charges._sum.amount ?? 0); // charges are negative debits

  const stats = [
    { key: 'merchants', label: 'Merchants', value: num(merchantIds.size) },
    { key: 'shipments_total', label: 'Shipments (lifetime)', value: num(totalShipments), accent: true },
    { key: 'shipments_30d', label: 'Shipments (30d)', value: num(shipments30d) },
    { key: 'delivered_rate', label: 'Delivered rate', value: pct(deliveredShipments, totalShipments) },
    { key: 'shipping_spend', label: 'Shipping spend (charged)', value: rupiah(spend) },
    { key: 'credit_outstanding', label: 'Prepaid credit outstanding', value: rupiah(creditOutstanding._sum.balance ?? 0) },
  ];

  return res.json(ok({ stats }, req.requestId ?? 'req_unknown'));
});

// ── GET /customers ──────────────────────────────────────────────────

router.get('/customers', async (req, res) => {
  const [dir, shipAgg, deliveredAgg, chargeAgg, lastTxnAgg, balances] = await Promise.all([
    loadAccountDirectory(),
    prisma.shipment.groupBy({
      by: ['accountId'],
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    prisma.shipment.groupBy({
      by: ['accountId'],
      where: { status: DELIVERED },
      _count: { _all: true },
    }),
    prisma.shippingCreditTransaction.groupBy({
      by: ['accountId'],
      where: { kind: 'shipment_charge' },
      _sum: { amount: true },
    }),
    prisma.shippingCreditTransaction.groupBy({
      by: ['accountId'],
      _max: { createdAt: true },
    }),
    prisma.shippingCredit.findMany({ select: { accountId: true, balance: true } }),
  ]);

  const shipBy = new Map(shipAgg.map((r) => [r.accountId, r]));
  const deliveredBy = new Map(deliveredAgg.map((r) => [r.accountId, r._count._all]));
  const chargeBy = new Map(chargeAgg.map((r) => [r.accountId, Math.abs(r._sum.amount ?? 0)]));
  const lastTxnBy = new Map(lastTxnAgg.map((r) => [r.accountId, r._max.createdAt]));
  const balanceBy = new Map(balances.map((r) => [r.accountId, r.balance]));

  // Union of directory + anything that only appears in shipment rows.
  const ids = new Set<string>([...dir.keys(), ...shipBy.keys()]);

  const customers = [...ids].map((accountId) => {
    const info = dir.get(accountId);
    const ship = shipBy.get(accountId);
    const lastActiveAt = maxDate(ship?._max.createdAt, lastTxnBy.get(accountId));
    const signupAt = minDate(info?.signupAt, ship?._min.createdAt);
    const shipments = ship?._count._all ?? 0;
    const metrics = [
      { label: 'Shipments', value: num(shipments) },
      { label: 'Delivered', value: num(deliveredBy.get(accountId) ?? 0) },
      { label: 'Shipping spend', value: rupiah(chargeBy.get(accountId) ?? 0) },
      { label: 'Credit balance', value: rupiah(balanceBy.get(accountId) ?? 0) },
      {
        label: 'Last shipment',
        value: ship?._max.createdAt ? ship._max.createdAt.toISOString().slice(0, 10) : '—',
      },
    ];
    return {
      id: accountId,
      email: info?.email ?? null,
      name: info?.name ?? null,
      signupAt: iso(signupAt),
      lastActiveAt: iso(lastActiveAt),
      status: info?.status ?? (shipments > 0 ? 'active' : null),
      metrics,
    };
  });

  // Most recently active first; never-active last.
  customers.sort((a, b) => (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? ''));

  return res.json(ok({ customers }, req.requestId ?? 'req_unknown'));
});

// ── GET /transactions ───────────────────────────────────────────────

router.get('/transactions', async (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 100;

  const [dir, shipments, creditTxns, totalShipments, deliveredShipments, chargeSum, topupSum] =
    await Promise.all([
      loadAccountDirectory(),
      prisma.shipment.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          accountId: true,
          courierCode: true,
          courierServiceCode: true,
          waybillId: true,
          status: true,
          price: true,
          insurance: true,
          createdAt: true,
        },
      }),
      prisma.shippingCreditTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.shipment.count(),
      prisma.shipment.count({ where: { status: DELIVERED } }),
      prisma.shippingCreditTransaction.aggregate({
        where: { kind: 'shipment_charge' },
        _sum: { amount: true },
      }),
      prisma.shippingCreditTransaction.aggregate({
        where: { kind: 'topup' },
        _sum: { amount: true },
      }),
    ]);

  const shipmentRows = shipments.map((s) => ({
    id: s.id,
    at: s.createdAt.toISOString(),
    customer: customerLabel(dir, s.accountId),
    kind: 'shipment',
    amount: rupiah(s.price + s.insurance),
    status: s.status as string,
    description: [
      `${s.courierCode.toUpperCase()} ${s.courierServiceCode}`,
      s.waybillId ? `waybill ${s.waybillId}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }));

  const creditRows = creditTxns.map((t) => ({
    id: t.id,
    at: t.createdAt.toISOString(),
    customer: customerLabel(dir, t.accountId),
    kind: `credit_${t.kind}`, // credit_topup | credit_shipment_charge | …
    amount: rupiah(t.amount),
    status: 'posted',
    description: t.memo ?? null,
  }));

  const rows = [...shipmentRows, ...creditRows]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);

  const summary = [
    { label: 'Shipments (lifetime)', value: num(totalShipments) },
    { label: 'Delivered rate', value: pct(deliveredShipments, totalShipments) },
    { label: 'Shipping charged', value: rupiah(Math.abs(chargeSum._sum.amount ?? 0)) },
    { label: 'Credit top-ups', value: rupiah(topupSum._sum.amount ?? 0) },
  ];

  return res.json(ok({ summary, rows }, req.requestId ?? 'req_unknown'));
});

export default router;
