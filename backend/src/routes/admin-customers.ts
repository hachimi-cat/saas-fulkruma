import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import {
  fetchAppUsers,
  fetchAppStats,
  huudisAppConfigured,
} from '../lib/huudis-app.js';

/*
 * GET /api/v1/admin/customers — this product's own users, pulled from
 * Huudis (`/app/users`) using the product's OIDC client credentials.
 * Mounted behind `adminGuard`. Powers the admin "Customers" view.
 */

const router = Router();

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

router.get('/', async (req, res) => {
  if (!huudisAppConfigured()) {
    return res
      .status(503)
      .json(
        err(
          'HUUDIS_NOT_CONFIGURED',
          'HUUDIS_CLIENT_ID / HUUDIS_CLIENT_SECRET must be set to list customers.',
          req.requestId ?? 'req_unknown',
        ),
      );
  }
  try {
    const status = str(req.query.status) as 'all' | 'active' | 'disabled' | undefined;
    const limitRaw = str(req.query.limit);
    const [page, stats] = await Promise.all([
      fetchAppUsers({
        q: str(req.query.q),
        status,
        limit: limitRaw ? Number(limitRaw) : undefined,
        cursor: str(req.query.cursor),
      }),
      fetchAppStats().catch(() => null),
    ]);
    return res.json(ok({ ...page, stats }, req.requestId ?? 'req_unknown'));
  } catch (e) {
    return res
      .status(502)
      .json(err('HUUDIS_ERROR', (e as Error).message, req.requestId ?? 'req_unknown'));
  }
});

export default router;
