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

export default router;
