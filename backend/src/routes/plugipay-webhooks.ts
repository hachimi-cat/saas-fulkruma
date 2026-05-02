import { Router } from 'express';
import express from 'express';
import { ok, err } from '@forjio/sdk/http';
import crypto from 'node:crypto';
import { prisma } from '../lib/db.js';

const router = Router();

// Plugipay webhooks are signed with HMAC-SHA256 over the raw body using
// the per-endpoint secret configured in Plugipay's webhook-endpoints table.
// Header format: `t=<timestamp>,v1=<hex>` (Stripe-style).
const PLUGIPAY_WEBHOOK_SECRET = () => {
  const v = process.env.PLUGIPAY_WEBHOOK_SECRET;
  if (!v) throw new Error('PLUGIPAY_WEBHOOK_SECRET not set');
  return v;
};

function verifySignature(rawBody: Buffer, header: string | undefined): boolean {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const segment of header.split(',')) {
    const [k, v] = segment.split('=');
    if (!k) continue;
    parts[k.trim()] = v?.trim() ?? '';
  }
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;
  const payload = `${ts}.${rawBody.toString('utf8')}`;
  const expected = crypto
    .createHmac('sha256', PLUGIPAY_WEBHOOK_SECRET())
    .update(payload)
    .digest('hex');
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

interface PlugipayEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sigHeader = req.headers['plugipay-signature'] as string | undefined;
    const raw = req.body as Buffer;
    if (!verifySignature(raw, sigHeader)) {
      return res.status(401).json(err('BAD_SIGNATURE', 'plugipay signature invalid', req.requestId ?? 'req_unknown'));
    }

    let event: PlugipayEvent;
    try {
      event = JSON.parse(raw.toString('utf8')) as PlugipayEvent;
    } catch {
      return res.status(400).json(err('MALFORMED', 'body is not JSON', req.requestId ?? 'req_unknown'));
    }

    // Idempotency — once processed, return ok so Plugipay stops retrying.
    const seen = await prisma.processedEvent.findUnique({ where: { eventId: event.id } });
    if (seen) {
      return res.json(ok({ duplicate: true }, req.requestId ?? 'req_unknown'));
    }

    try {
      await dispatch(event);
      await prisma.processedEvent.create({ data: { eventId: event.id } });
    } catch (e) {
      console.error('[plugipay-webhook] dispatch failed', event.id, e);
      return res.status(500).json(err('DISPATCH_FAILED', String(e), req.requestId ?? 'req_unknown'));
    }
    res.json(ok({ received: true }, req.requestId ?? 'req_unknown'));
  },
);

async function dispatch(event: PlugipayEvent): Promise<void> {
  switch (event.type) {
    case 'plugipay.invoice.paid.v1':
      return handleInvoicePaid(event);
    case 'plugipay.subscription.canceled.v1':
      // For now we just log; license/delivery revocation is handled per-product
      // by emitting a `fulkruma.license.revoked.v1` from a future scheduled job.
      console.log('[plugipay-webhook] subscription.canceled', event.id);
      return;
    default:
      // Unknown event types are no-ops but recorded as processed to stop retries.
      return;
  }
}

async function handleInvoicePaid(event: PlugipayEvent): Promise<void> {
  // Plugipay invoice.paid carries: { invoiceId, accountId, checkoutSessionId?, lines[] }.
  // We commit reservations associated with the checkout session, releasing
  // their soft-hold. Stock-on-hand is decremented via a checkout_commit movement.
  const data = event.data as {
    invoiceId?: string;
    accountId?: string;
    checkoutSessionId?: string;
  };
  if (!data.checkoutSessionId) return;

  await prisma.$transaction(async (tx) => {
    const reservations = await tx.stockReservation.findMany({
      where: {
        checkoutSessionId: data.checkoutSessionId,
        consumedAt: null,
        releasedAt: null,
      },
    });
    for (const r of reservations) {
      await tx.stockReservation.update({
        where: { id: r.id },
        data: { consumedAt: new Date() },
      });
      await tx.variantStock.update({
        where: {
          variantId_warehouseId: { variantId: r.variantId, warehouseId: r.warehouseId },
        },
        data: { quantity: { decrement: r.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          variantId: r.variantId,
          warehouseId: r.warehouseId,
          delta: -r.quantity,
          reason: 'checkout_commit',
          referenceId: data.checkoutSessionId,
          note: `committed via plugipay invoice ${data.invoiceId ?? '?'}`,
        },
      });
    }
  });
}

export default router;
