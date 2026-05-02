import { Router } from 'express';
import { ok } from '@forjio/sdk/http';

const router = Router();

/** GET /api/v1/health — no auth, returns service name + status. Every
 *  Forjio service exposes the same shape so uptime monitors are uniform. */
router.get('/health', (req, res) => {
  res.json(
    ok(
      {
        service: process.env.FORJIO_SERVICE ?? 'forjio-brand',
        status: 'ok',
        version: process.env.npm_package_version ?? '0.0.1',
      },
      req.requestId ?? 'req_unknown',
    ),
  );
});

export default router;
