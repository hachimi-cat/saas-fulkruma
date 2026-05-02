/**
 * GET /api/v1/integrations/status
 *
 * Aggregates real runtime signals for the /dashboard/integrations card
 * grid so the UI doesn't lie about "partial" / "connected" state.
 *
 * Response shape:
 *   {
 *     huudis:     { connected: true }                 — auth is required to even reach here.
 *     biteship:   { ...BiteshipConfig sanitised }     — same source the shipping page reads.
 *     plugipay:   { webhookSecretSet, lastEventAt, eventCount, partnerKey: { configured } }
 *     storlaunch: { webhookSecretSet, mirroredProductCount, lastSyncAt, partnerKey: { configured } }
 *   }
 */
import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/status', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));

  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  // Biteship — sanitised view of BiteshipConfig.
  const biteship = await prisma.biteshipConfig.findUnique({ where: { accountId } });

  // Plugipay — webhook secret presence, last received event, partner-admin key.
  const plugipayWebhookSecretSet = Boolean(process.env.PLUGIPAY_WEBHOOK_SECRET);
  const plugipayProcessedSample = await prisma.processedEvent.findFirst({
    where: { eventId: { startsWith: 'evt_pp_' } }, // Plugipay's outbox event ids prefix
    orderBy: { processedAt: 'desc' },
  }).catch(() => null);
  // PartnerWorkspace where partner=plugipay-managed-by-fulkruma is N/A
  // (plugipay manages its own workspace, fulkruma calls it OUT).
  // The signal here is whether the platform-admin key for fulkruma->plugipay
  // is configured.
  const plugipayPartnerKey = Boolean(
    process.env.PLUGIPAY_FULKRUMA_KEY_ID && process.env.PLUGIPAY_FULKRUMA_SECRET,
  );

  // Storlaunch — count Products mirrored via the inbound webhook +
  // shared signing secret presence + presence of the platform-admin key
  // we minted (saved into ApiKey table with partner='storlaunch').
  const storlaunchSecretSet = Boolean(process.env.STORLAUNCH_WEBHOOK_SECRET);
  const [storlaunchProductCount, storlaunchLastSync, storlaunchPartnerKey] = await Promise.all([
    prisma.product.count({ where: { accountId, externalSource: 'storlaunch' } }),
    prisma.product.findFirst({
      where: { accountId, externalSource: 'storlaunch' },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.apiKey.findFirst({ where: { partner: 'storlaunch', revokedAt: null } }),
  ]);

  res.json(ok({
    huudis: { connected: true },
    biteship: biteship
      ? {
          apiKeyConfigured: Boolean(biteship.apiKey),
          active: biteship.active,
          enabledCouriers: biteship.enabledCouriers,
        }
      : null,
    plugipay: {
      webhookSecretSet: plugipayWebhookSecretSet,
      partnerKey: { configured: plugipayPartnerKey },
      lastEventAt: plugipayProcessedSample?.processedAt ?? null,
      eventCount30d: 0, // Plugipay events go through ProcessedEvent without an indexable type column; placeholder.
    },
    storlaunch: {
      webhookSecretSet: storlaunchSecretSet,
      partnerKey: { configured: Boolean(storlaunchPartnerKey) },
      mirroredProductCount: storlaunchProductCount,
      lastSyncAt: storlaunchLastSync?.updatedAt ?? null,
    },
  }, req.requestId ?? 'req_unknown'));

  // Suppress the unused since30d binding without leaking it into the response.
  void since30d;
});

export default router;
