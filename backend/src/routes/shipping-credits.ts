import { Router } from 'express';
import { z } from 'zod';
import { ok, err } from '@forjio/sdk/http';
import { requireAuth } from '../middleware/auth.js';
import {
  getBalance,
  listTransactions,
  applyTransaction,
  type ShippingCreditTransactionKind,
} from '../services/shipping-credit-service.js';
import { getCustomerForAccount, getPlatformClient } from '../services/plugipay-billing.js';
import { prisma } from '../lib/db.js';

// S-046: per-merchant prepaid shipping credit. Merchants get a
// balance + ledger so they can audit what was charged / topped up.
// Top-up itself is initiated by Storlaunch (which creates the
// Plugipay session), then the Plugipay webhook handler in Storlaunch
// calls back here with kind=topup to credit. Manual_adjustment is
// available for ops/backfill.

const router = Router();
router.use(requireAuth);

// GET /shipping-credits — balance for the calling merchant.
router.get('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  const reqId = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const balance = await getBalance(accountId);
  return res.json(ok(balance, reqId));
});

// GET /shipping-credits/transactions — paginated ledger.
const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});
router.get('/transactions', async (req, res) => {
  const accountId = req.auth?.accountId;
  const reqId = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(err('VALIDATION_ERROR', parsed.error.message, reqId));
  const result = await listTransactions(accountId, parsed.data);
  return res.json(ok(result, reqId));
});

// POST /shipping-credits/topup — credit the merchant's balance.
// Called BY STORLAUNCH from its Plugipay webhook handler when a
// topup checkout completes. The auth boundary is the platform API
// key + X-Fulkruma-On-Behalf-Of: <merchant accountId>, same as
// every other Storlaunch→Fulkruma RPC.
const topupSchema = z.object({
  amount: z.number().int().positive(),
  externalRef: z.string().min(1).max(255).optional(),
  memo: z.string().max(500).optional(),
});
router.post('/topup', async (req, res) => {
  const accountId = req.auth?.accountId;
  const reqId = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const parsed = topupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION_ERROR', parsed.error.message, reqId));

  const balance = await applyTransaction({
    accountId,
    amount: parsed.data.amount,
    kind: 'topup',
    externalRef: parsed.data.externalRef ?? null,
    memo: parsed.data.memo ?? null,
  });
  return res.json(ok(balance, reqId));
});

// POST /shipping-credits/adjust — ops/promo credit or debit. Same
// gate as topup; admin scoping happens at the API key level (storlaunch
// itself + ops keys can call; merchant keys cannot reach this route
// because requireAuth restricts the scope).
const adjustSchema = z.object({
  amount: z.number().int(),  // signed
  kind: z.enum(['manual_adjustment', 'shipment_refund']),
  shipmentId: z.string().optional(),
  externalRef: z.string().optional(),
  memo: z.string().max(500).optional(),
});
router.post('/adjust', async (req, res) => {
  const accountId = req.auth?.accountId;
  const reqId = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION_ERROR', parsed.error.message, reqId));

  const balance = await applyTransaction({
    accountId,
    amount: parsed.data.amount,
    kind: parsed.data.kind as ShippingCreditTransactionKind,
    shipmentId: parsed.data.shipmentId ?? null,
    externalRef: parsed.data.externalRef ?? null,
    memo: parsed.data.memo ?? null,
  });
  return res.json(ok(balance, reqId));
});

// POST /shipping-credits/checkout — S-051: start a Plugipay checkout
// session for a top-up. Merchant pays Forjio via the Fulkruma billing
// Plugipay workspace (same one tier subscriptions use). On success the
// /webhooks/plugipay handler fires applyTransaction(kind=topup).
const checkoutSchema = z.object({
  amount: z.number().int().min(10_000).max(10_000_000),
  // Optional contact info — populated when standalone fulkruma users
  // first top up (no existing Plugipay customer yet).
  email: z.string().email().optional(),
  name: z.string().min(1).max(120).optional(),
});

router.post('/checkout', async (req, res) => {
  const accountId = req.auth?.accountId;
  const reqId = req.requestId ?? 'req_unknown';
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', reqId));
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(err('VALIDATION_ERROR', parsed.error.message, reqId));

  // Resolve buyer identity for the Plugipay customer record. The
  // top-up frontend collects the email field on first top-up and
  // passes it here; subsequent top-ups skip the prompt because
  // getCustomerForAccount finds the existing plugipayCustomerId on
  // the Subscription row.
  const existing = await prisma.subscription.findUnique({
    where: { accountId },
    select: { plugipayCustomerId: true },
  });
  const buyerEmail = parsed.data.email;
  const buyerName = parsed.data.name ?? accountId;
  if (!existing?.plugipayCustomerId && !buyerEmail) {
    return res.status(400).json(err(
      'EMAIL_REQUIRED',
      'First top-up needs an email — pass `email` in the request body.',
      reqId,
    ));
  }

  try {
    // Email is only consulted when creating a new Plugipay customer;
    // existing customers short-circuit on plugipayCustomerId. Empty
    // string is safe here because the early-return path skips it.
    const customerId = await getCustomerForAccount(accountId, buyerEmail ?? '', buyerName);
    const client = getPlatformClient();
    const baseUrl = process.env.FULKRUMA_BASE_URL ?? 'https://fulkruma.com';
    const session = await client.checkoutSessions.create({
      amount: parsed.data.amount,
      currency: 'IDR',
      customerId,
      methods: ['qris', 'va', 'ewallet', 'card'],
      successUrl: `${baseUrl}/dashboard/shipping-credits?toppedup=${parsed.data.amount}`,
      cancelUrl: `${baseUrl}/dashboard/shipping-credits`,
      lineItems: [{
        name: `Shipping credit top-up — Rp ${parsed.data.amount.toLocaleString('id-ID')}`,
        quantity: 1,
        unitAmount: parsed.data.amount,
      }],
      metadata: {
        // Webhook handler routes on these.
        shippingCreditTopup: 'true',
        fulkrumaAccountId: accountId,
        requestedAmount: String(parsed.data.amount),
      },
    });
    return res.json(ok({
      checkoutUrl: (session as { hostedUrl?: string }).hostedUrl,
      sessionId: session.id,
      amount: parsed.data.amount,
    }, reqId));
  } catch (e) {
    console.error('[shipping-credits/checkout] failed', e);
    return res.status(502).json(err('PLUGIPAY_FAILED', (e as Error).message, reqId));
  }
});

export default router;
