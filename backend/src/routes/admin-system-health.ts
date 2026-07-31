import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { collectSystemHealth } from '../lib/system-health.js';

/*
 * GET /api/v1/admin/system-health — fulkruma's operator health view.
 *
 * Mounted behind `adminGuard`; powers `SystemHealthPanel`. Mandatory
 * admin-portal standard.
 *
 * Distinct from the unauthenticated liveness probe: this one reaches the
 * database and every configured integration, so it is authenticated (it
 * reveals dependency topology) and the panel polls it at 30s. An
 * UNCONFIGURED integration reports 'skipped', never omitted.
 */

const router = Router();
const rid = (req: { requestId?: string }) => req.requestId ?? 'req_unknown';

router.get('/', async (req, res) => {
  try {
    return res.json(ok(await collectSystemHealth(), rid(req)));
  } catch (e) {
    // Only reachable if the collector itself throws — individual probes
    // already degrade to their own row.
    return res.status(500).json(err('HEALTH_COLLECT_FAILED', (e as Error).message, rid(req)));
  }
});

export default router;
