import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as billing from '../services/billing.js';
import * as plugipayBilling from '../services/plugipay-billing.js';
import type { PlanKey } from '../lib/plans.js';

const router = Router();

function reqId(req: { requestId?: string }): string { return req.requestId ?? 'req_unknown'; }

// GET /billing/plans — public, no auth. Powers the landing-page Pricing
// section + the /dashboard/billing plan picker.
router.get('/plans', (req, res) => {
  res.json(ok(billing.listPlans(), reqId(req)));
});

router.get('/plan', requireAuth, async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId(req)));
  const view = await billing.getCurrentPlan(accountId);
  res.json(ok(view, reqId(req)));
});

router.get('/subscription', requireAuth, async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId(req)));
  const view = await billing.getSubscriptionView(accountId);
  res.json(ok(view, reqId(req)));
});

router.get('/usage', requireAuth, async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId(req)));
  const view = await billing.getUsage(accountId);
  res.json(ok(view, reqId(req)));
});

router.get('/invoices', requireAuth, async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId(req)));
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const limit = req.query.limit ? Math.min(50, parseInt(String(req.query.limit), 10) || 20) : 20;
  const page = await billing.getBillingHistory(accountId, { cursor, limit });
  res.json(ok(page, reqId(req)));
});

const checkoutSchema = z.object({
  plan: z.enum(['STARTER', 'GROWTH', 'SCALE']),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

router.post('/checkout', requireAuth, async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId(req)));
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION', parsed.error.message, reqId(req)));

  // Email comes from the JWT for portal-proxy callers; from the body for SDK callers.
  const email = parsed.data.email ?? (req.auth as { email?: string })?.email;
  if (!email) return res.status(400).json(err('VALIDATION', 'email required (set in JWT claim or request body)', reqId(req)));

  try {
    const result = await plugipayBilling.startSubscription(accountId, email, parsed.data.plan as PlanKey, parsed.data.name);
    res.json(ok(result, reqId(req)));
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('not configured')) {
      return res.status(503).json(err('PLAN_NOT_CONFIGURED', msg, reqId(req)));
    }
    return res.status(500).json(err('CHECKOUT_FAILED', msg, reqId(req)));
  }
});

router.post('/cancel', requireAuth, async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId(req)));
  try {
    await plugipayBilling.cancelSubscription(accountId);
    const view = await billing.getSubscriptionView(accountId);
    res.json(ok(view, reqId(req)));
  } catch (e) {
    return res.status(500).json(err('CANCEL_FAILED', (e as Error).message, reqId(req)));
  }
});

export default router;
