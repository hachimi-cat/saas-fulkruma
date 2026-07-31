import type { AdminEndpoints } from '@forjio/admin-ui';

/*
 * Where Fulkruma serves the admin-portal standard, FROM THE BROWSER.
 *
 * Declared rather than inherited. @forjio/admin-ui ships a default, and
 * six sibling products shipped against it this week and 404'd in the
 * browser because their BFF proxy rewrites the path — the routes
 * themselves answered fine, which is why curling the backend did not
 * catch it. Fulkruma's proxy happens to match the default today; these
 * paths are written out anyway so that stops being luck.
 */
export const FULKRUMA_ADMIN_ENDPOINTS: AdminEndpoints = {
  metrics: '/api/v1/console/admin/metrics',
  health: '/api/v1/console/admin/system-health',
  featureFlags: '/api/v1/console/admin/feature-flags',
  customers: '/api/v1/console/admin/customers',
  transactions: '/api/v1/console/admin/transactions',
};
