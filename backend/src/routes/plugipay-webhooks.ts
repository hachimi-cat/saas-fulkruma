/**
 * Inbound webhook receiver for Plugipay billing events. Listens for
 *   - invoice.paid           → flip Subscription to ACTIVE + record Invoice
 *   - subscription.canceled  → reset to FREE
 *
 * Mounted before express.json() so the raw body survives signature
 * verification. Header: `Plugipay-Signature: t=<unix>,v1=<hex>`,
 * payload `${ts}.${rawBody}` keyed on PLUGIPAY_WEBHOOK_SECRET.
 */
import { Router } from 'express';
import express from 'express';
import { ok, err } from '@forjio/sdk/http';
import crypto from 'node:crypto';
import { applyInvoicePaid, applySubscriptionCanceled } from '../services/plugipay-billing.js';
import type { PlanKey } from '../lib/plans.js';

const router = Router();

interface PlugipayEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

function verifySignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const segment of header.split(',')) {
    const [k, v] = segment.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;
  const drift = Math.abs(Math.floor(Date.now() / 1000) - Number.parseInt(ts, 10));
  if (!Number.isFinite(drift) || drift > 300) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${rawBody.toString('utf8')}`)
    .digest('hex');
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const rid = req.requestId ?? 'req_unknown';
  const secret = process.env.PLUGIPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(401).json(err('NO_SECRET', 'PLUGIPAY_WEBHOOK_SECRET not configured', rid));
  const sigHeader =
    (req.headers['x-plugipay-signature'] as string | undefined) ??
    (req.headers['plugipay-signature'] as string | undefined);
  const raw = req.body as Buffer;
  if (!verifySignature(raw, sigHeader, secret)) {
    return res.status(401).json(err('BAD_SIGNATURE', 'plugipay signature invalid', rid));
  }

  let event: PlugipayEvent;
  try {
    event = JSON.parse(raw.toString('utf8')) as PlugipayEvent;
  } catch {
    return res.status(400).json(err('MALFORMED', 'body is not JSON', rid));
  }

  try {
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data as {
          id: string;
          customerId: string;
          subscriptionId?: string;
          total: number;
          currency: string;
          metadata?: Record<string, unknown>;
          receiptUrl?: string;
        };
        const md = (invoice.metadata ?? {}) as Record<string, unknown>;
        const accountId = String(md.fulkrumaAccountId ?? '');
        const tier = String(md.fulkrumaTier ?? '').toUpperCase() as PlanKey;
        if (!accountId || !tier) break;
        // Period bounds come from the parent subscription on the SDK shape;
        // fall back to a 30-day window from now if absent (defensive).
        const sub = invoice as unknown as {
          currentPeriodStart?: string;
          currentPeriodEnd?: string;
        };
        const now = new Date();
        const start = sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : now;
        const end = sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd)
          : new Date(now.getTime() + 30 * 24 * 3600 * 1000);
        await applyInvoicePaid(accountId, tier, start, end, {
          id: invoice.id,
          amount: invoice.total,
          currency: invoice.currency,
          receiptUrl: invoice.receiptUrl,
        });
        break;
      }
      case 'subscription.canceled': {
        const sub = event.data as { metadata?: Record<string, unknown> };
        const md = (sub.metadata ?? {}) as Record<string, unknown>;
        const accountId = String(md.fulkrumaAccountId ?? '');
        if (!accountId) break;
        await applySubscriptionCanceled(accountId);
        break;
      }
      default:
        // Unknown event types — ack so plugipay stops retrying.
        break;
    }
  } catch (e) {
    console.error('[plugipay-webhook] dispatch failed', event.id, e);
    return res.status(500).json(err('DISPATCH_FAILED', String(e), rid));
  }

  res.json(ok({ received: true, type: event.type }, rid));
});

export default router;
