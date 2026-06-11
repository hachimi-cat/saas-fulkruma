import { Router } from 'express';
import { ok } from '@forjio/sdk/http';
import warehouses from './warehouses.js';
import addresses from './addresses.js';
import stock from './stock.js';
import products from './products.js';
import shipments from './shipments.js';
import shippingCredits from './shipping-credits.js';
import licenses from './licenses.js';
import deliveries from './deliveries.js';
import apiKeys from './api-keys.js';
import webhooksRouter from './webhooks.js';
import auditLog from './audit-log.js';
import shipping from './shipping.js';
import stats from './stats.js';
import admin from './admin.js';
import adminCrm from './admin-crm.js';
import adminCustomersRouter from './admin-customers.js';
import { adminGuard } from '../middleware/admin-guard.js';
import integrations from './integrations.js';
import billing from './billing.js';
import plugipayWebhooks from './plugipay-webhooks.js';
import auth from './auth.js';
import huudisProxy from './huudis-proxy.js';

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

router.use('/auth', auth);
router.use('/huudis', huudisProxy);
router.use('/warehouses', warehouses);
router.use('/addresses', addresses);
router.use('/products', products);
router.use('/stock', stock);
router.use('/shipments', shipments);
router.use('/shipping-credits', shippingCredits);
router.use('/licenses', licenses);
router.use('/deliveries', deliveries);
router.use('/api-keys', apiKeys);
router.use('/webhooks', webhooksRouter);
router.use('/audit-log', auditLog);
router.use('/shipping', shipping);
router.use('/stats', stats);
// CRM connector for the central Forjio admin portal. Mounted BEFORE
// the partner-billing /admin router: that one runs requireAuth first,
// which would 401 the portal's secret-only (X-Forjio-Admin-Secret)
// requests before adminGuard could accept them.
router.use('/admin/crm', adminGuard, adminCrm);
router.use('/admin', admin);
router.use('/admin/customers', adminGuard, adminCustomersRouter);
router.use('/integrations', integrations);
router.use('/billing', billing);
router.use('/webhooks/plugipay', plugipayWebhooks);

export default router;
