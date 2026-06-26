/**
 * Pattern-2 partner-billing admin endpoints.
 *
 * Mounted at `/api/v1/admin`. Gated by `adminGuard`, which accepts
 * THREE credentials (see ../middleware/admin-guard.ts):
 *   - an `admin`-role BFF session  (the in-fulkruma admin portal)
 *   - the `X-Forjio-Admin-Secret`  (cross-product admin proxy)
 *   - an HMAC key with the `fulkruma:platform:admin` scope (partners)
 *
 * `requireAuth` still runs first so the HMAC path is resolved into
 * `req.auth` before `adminGuard` inspects its scope.
 *
 * Mirrors plugipay's admin surface (`project_forjio_plugipay_storlaunch_
 * integration.md`):
 *   POST /v1/admin/workspaces           → idempotent provision
 *   GET  /v1/admin/workspaces/:id       → read-back
 *   GET  /v1/admin/partner/usage        → monthly rollup numbers
 */
import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from './../middleware/auth.js';
import { adminGuard } from '../middleware/admin-guard.js';
import { writeAuditLog } from '../lib/audit.js';
import { ensurePartnerPaidTier } from '../services/billing.js';

const router = Router();

router.use(requireAuth);
router.use(adminGuard);

const KNOWN_PARTNERS = ['storlaunch', 'ripllo', 'malapos'] as const;

const provisionSchema = z.object({
  accountId: z.string().min(1),
  partner: z.enum(KNOWN_PARTNERS),
  discountRate: z.number().min(0).max(0.5),
  brandName: z.string().optional(),
  businessEmail: z.string().email().optional(),
});

router.post('/workspaces', async (req, res) => {
  const callerPartner = (req.auth as { partner?: string })?.partner;
  const parsed = provisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const body = parsed.data;
  if (callerPartner && callerPartner !== body.partner) {
    return res.status(403).json(err('PARTNER_MISMATCH', `Key bound to partner '${callerPartner}', cannot provision for '${body.partner}'`, req.requestId ?? 'req_unknown'));
  }

  const existing = await prisma.partnerWorkspace.findUnique({ where: { accountId: body.accountId } });
  if (existing && existing.partner !== body.partner) {
    return res.status(409).json(err('CROSS_PARTNER', `Account ${body.accountId} already belongs to partner '${existing.partner}'`, req.requestId ?? 'req_unknown'));
  }
  // Idempotent — same partner re-call returns the existing record without
  // changing the frozen discountRate (defends against partner-side rate drift).
  const ws = existing
    ? existing
    : await prisma.partnerWorkspace.create({
        data: {
          accountId: body.accountId,
          partner: body.partner,
          discountRate: body.discountRate,
          brandName: body.brandName ?? null,
          businessEmail: body.businessEmail ?? null,
        },
      });
  // Floor the workspace at the first PAID plan — it's billed through the
  // partner, so paid Fulkruma features must be unlocked. Idempotent + safe on
  // both the fresh-create and the same-partner re-call path; never downgrades.
  await ensurePartnerPaidTier(body.accountId);
  if (!existing) {
    await writeAuditLog(prisma, {
      accountId: body.accountId,
      actorType: 'api_key',
      actorId: (req.auth as { sub?: string })?.sub ?? null,
      action: 'partner.workspace_provisioned',
      targetType: 'PartnerWorkspace', targetId: body.accountId,
      after: { partner: body.partner, discountRate: body.discountRate },
    });
  }
  res.status(existing ? 200 : 201).json(ok(ws, req.requestId ?? 'req_unknown'));
});

router.get('/workspaces/:accountId', async (req, res) => {
  const callerPartner = (req.auth as { partner?: string })?.partner;
  const ws = await prisma.partnerWorkspace.findUnique({ where: { accountId: req.params.accountId } });
  if (!ws) return res.status(404).json(err('NOT_FOUND', 'workspace not provisioned', req.requestId ?? 'req_unknown'));
  if (callerPartner && callerPartner !== ws.partner) {
    return res.status(403).json(err('PARTNER_MISMATCH', `Key bound to partner '${callerPartner}'`, req.requestId ?? 'req_unknown'));
  }
  res.json(ok(ws, req.requestId ?? 'req_unknown'));
});

router.get('/partner/usage', async (req, res) => {
  const callerPartner = (req.auth as { partner?: string })?.partner;
  const partner = (req.query.partner as string | undefined) ?? callerPartner;
  if (!partner) return res.status(400).json(err('VALIDATION', 'partner query or partner-bound key required', req.requestId ?? 'req_unknown'));
  if (callerPartner && callerPartner !== partner) {
    return res.status(403).json(err('PARTNER_MISMATCH', `Key bound to partner '${callerPartner}'`, req.requestId ?? 'req_unknown'));
  }
  const fromStr = req.query.from as string | undefined;
  const toStr = req.query.to as string | undefined;
  if (!fromStr || !toStr) return res.status(400).json(err('VALIDATION', 'from + to (ISO datetime) required', req.requestId ?? 'req_unknown'));
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return res.status(400).json(err('VALIDATION', 'from / to must be parseable dates', req.requestId ?? 'req_unknown'));
  }

  const partnerWorkspaces = await prisma.partnerWorkspace.findMany({ where: { partner } });
  const accountIds = partnerWorkspaces.map((w) => w.accountId);
  if (accountIds.length === 0) {
    return res.json(ok({
      partner,
      period: { from: from.toISOString(), to: to.toISOString() },
      totals: { shipments: 0, licensesIssued: 0, deliveries: 0, chargeableCents: 0 },
      byMerchant: [],
    }, req.requestId ?? 'req_unknown'));
  }

  // Per-merchant counts in the window.
  const [shipments, licenses, deliveries] = await Promise.all([
    prisma.shipment.groupBy({
      by: ['accountId'],
      where: { accountId: { in: accountIds }, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.license.groupBy({
      by: ['accountId'],
      where: { accountId: { in: accountIds }, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.delivery.groupBy({
      by: ['accountId'],
      where: { accountId: { in: accountIds }, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
  ]);
  const shipBy = Object.fromEntries(shipments.map((r) => [r.accountId, r._count._all]));
  const licBy = Object.fromEntries(licenses.map((r) => [r.accountId, r._count._all]));
  const delBy = Object.fromEntries(deliveries.map((r) => [r.accountId, r._count._all]));

  // Chargeable = (shipments + licenses + deliveries) × discountRate.
  // Treat each event as 1 unit at IDR 1000 baseline for the rollup;
  // production accounting uses the partner's own per-event price card.
  const BASELINE_CENTS = 100_000; // IDR 1000 per event
  const byMerchant = partnerWorkspaces.map((w) => {
    const ship = shipBy[w.accountId] ?? 0;
    const lic = licBy[w.accountId] ?? 0;
    const del = delBy[w.accountId] ?? 0;
    const chargeableCents = Math.round((ship + lic + del) * BASELINE_CENTS * w.discountRate);
    return {
      accountId: w.accountId,
      shipments: ship,
      licensesIssued: lic,
      deliveries: del,
      chargeableCents,
    };
  });
  const totals = byMerchant.reduce(
    (acc, m) => ({
      shipments: acc.shipments + m.shipments,
      licensesIssued: acc.licensesIssued + m.licensesIssued,
      deliveries: acc.deliveries + m.deliveries,
      chargeableCents: acc.chargeableCents + m.chargeableCents,
    }),
    { shipments: 0, licensesIssued: 0, deliveries: 0, chargeableCents: 0 },
  );

  res.json(ok({
    partner,
    period: { from: from.toISOString(), to: to.toISOString() },
    totals,
    byMerchant,
  }, req.requestId ?? 'req_unknown'));
});

export default router;
