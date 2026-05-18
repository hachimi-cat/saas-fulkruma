/**
 * POST /api/v1/webhooks/biteship — receives Biteship status updates and
 * mirrors them into the merchant's Shipment + ShipmentEvent rows.
 *
 * Biteship signs the webhook with HMAC-SHA256(body, BITESHIP_WEBHOOK_TOKEN)
 * sent via `X-Biteship-Signature`. The adapter's verifyWebhook checks
 * this; in production the env var is set, in dev with no token configured
 * the adapter accepts unsigned bodies.
 *
 * Public — no requireAuth. Idempotency comes for free from the natural
 * shipment lookup; replaying the same status is harmless.
 */
import { Router } from 'express';
import express from 'express';
import { ok, err } from '@forjio/sdk/http';
import { prisma } from '../lib/db.js';
import { createBiteshipAdapter, handleWebhook } from '../services/shipping-service.js';

const router = Router();

// Biteship's webhook installer probes the URL before activating. Some
// installs do GET, some POST with an empty body. Respond 200 to both so
// the installer succeeds; real status pushes always carry a body.
router.get('/', (_req, res) => res.json({ ok: true }));

router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const reqId = req.requestId ?? 'req_unknown';
    const raw = req.body as Buffer;
    let body: Record<string, unknown>;
    const rawStr = raw?.toString('utf8') ?? '';
    // Installer ping: empty body → 200 OK (no signature required).
    if (!rawStr.trim()) {
      return res.json(ok({ received: true, skipped: 'installer_ping' }, reqId));
    }
    try {
      body = JSON.parse(rawStr);
    } catch {
      return res.status(400).json(err('MALFORMED', 'body is not JSON', reqId));
    }
    const adapter = createBiteshipAdapter();
    const sigHeader =
      (req.headers['x-biteship-signature'] as string | undefined) ??
      (req.headers['x-biteship-webhook-signature'] as string | undefined);
    // F-008 bootstrap log: Biteship's webhook create API doesn't return a
    // signing secret and the docs don't document the signature scheme —
    // log every incoming header so we can configure verification after
    // observing the first real push.
    console.log('[biteship-webhook] headers:', JSON.stringify(req.headers));
    if (!adapter.verifyWebhook(sigHeader, rawStr)) {
      return res.status(401).json(err('BAD_SIGNATURE', 'biteship signature invalid', reqId));
    }
    const parsed = adapter.parseWebhook(body);
    if (!parsed.orderId) {
      return res.json(ok({ received: true, skipped: 'no_order_id' }, reqId));
    }
    try {
      const result = await handleWebhook(prisma, parsed);
      if (!result) {
        // Unknown order — Biteship sometimes retries against stale ids.
        // Ack so they stop retrying; nothing to mirror.
        return res.json(ok({ received: true, skipped: 'unknown_order' }, reqId));
      }
      return res.json(ok({ received: true, shipmentId: result.shipmentId, status: result.status }, reqId));
    } catch (e) {
      console.error('[biteship-webhook] failed', e);
      // Return 200 so Biteship's queue doesn't pile up retries — the
      // failure is logged for manual reconciliation.
      return res.status(200).json({ received: true, error: String(e) });
    }
  },
);

export default router;
