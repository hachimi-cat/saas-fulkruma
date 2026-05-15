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
import { applyInvoicePaid, applySubscriptionCanceled, getPlatformClient } from '../services/plugipay-billing.js';
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
      // Plugipay emits fully-qualified `plugipay.<entity>.<verb>.v1`
      // types per ADR-0006. The bare `invoice.paid` / `subscription.
      // canceled` we matched before never fired (F-002 drift).
      case 'plugipay.invoice.paid.v1': {
        // Envelope: `event.data.object` is the entity; reading
        // `event.data` flat was the other half of F-002.
        const obj = ((event.data as { object?: Record<string, unknown> })?.object ?? {}) as {
          id?: string;
          subscriptionId?: string;
          total?: number;
          currency?: string;
          metadata?: Record<string, unknown>;
          receiptUrl?: string;
        };
        // Auto-issued subscription invoices have empty metadata —
        // Plugipay stores the merchant linkage on the SUBSCRIPTION.
        // Resolve it via SDK lookup (P-006 + L-002 pattern).
        const subId = obj.subscriptionId;
        if (!subId) break;
        let accountId: string | undefined;
        let tier: PlanKey | undefined;
        let periodStart: Date | undefined;
        let periodEnd: Date | undefined;
        try {
          const sub = await getPlatformClient().subscriptions.get(subId) as unknown as {
            metadata?: { fulkrumaAccountId?: string; fulkrumaTier?: string };
            currentPeriodStart?: string;
            currentPeriodEnd?: string;
          };
          accountId = sub.metadata?.fulkrumaAccountId;
          const t = (sub.metadata?.fulkrumaTier ?? '').toUpperCase();
          if (t === 'STARTER' || t === 'GROWTH' || t === 'SCALE') tier = t as PlanKey;
          if (sub.currentPeriodStart) periodStart = new Date(sub.currentPeriodStart);
          if (sub.currentPeriodEnd) periodEnd = new Date(sub.currentPeriodEnd);
        } catch (e) {
          console.warn('[plugipay-webhook] could not fetch subscription', subId, (e as Error).message);
        }
        if (!accountId || !tier) break;
        const now = new Date();
        await applyInvoicePaid(accountId, tier,
          periodStart ?? now,
          periodEnd ?? new Date(now.getTime() + 30 * 24 * 3600 * 1000),
          {
            id: obj.id ?? '',
            amount: obj.total ?? 0,
            currency: obj.currency ?? 'IDR',
            receiptUrl: obj.receiptUrl,
          },
        );
        break;
      }
      case 'plugipay.subscription.canceled.v1': {
        // For subscription events `data.object` IS the subscription —
        // its metadata is what startSubscription stamped at create time.
        const obj = ((event.data as { object?: Record<string, unknown> })?.object ?? {}) as {
          metadata?: Record<string, unknown>;
        };
        const md = (obj.metadata ?? {}) as Record<string, unknown>;
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
