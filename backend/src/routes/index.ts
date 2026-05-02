import { Router } from 'express';
import { ok } from '@forjio/sdk/http';
import warehouses from './warehouses.js';
import addresses from './addresses.js';
import stock from './stock.js';
import shipments from './shipments.js';
import licenses from './licenses.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json(
    ok(
      {
        service: process.env.FORJIO_SERVICE ?? 'fulkruma',
        status: 'ok',
        version: process.env.npm_package_version ?? '0.0.1',
      },
      req.requestId ?? 'req_unknown',
    ),
  );
});

router.use('/warehouses', warehouses);
router.use('/addresses', addresses);
router.use('/stock', stock);
router.use('/shipments', shipments);
router.use('/licenses', licenses);

export default router;
