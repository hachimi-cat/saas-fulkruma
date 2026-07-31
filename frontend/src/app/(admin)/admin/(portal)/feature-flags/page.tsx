'use client';

/*
 * Feature flags — MANDATORY admin-portal standard.
 * See forjio/documentation/2. Technical/13-Admin-Portal-Standard.md.
 * Body from @forjio/admin-ui; data from fulkruma's adapter under
 * backend/src/routes/admin-*.ts.
 */

import { FeatureFlagsPanel } from '@forjio/admin-ui';
import { FULKRUMA_ADMIN_ENDPOINTS } from '@/lib/admin-endpoints';

export default function Page() {
  return <FeatureFlagsPanel endpoint={FULKRUMA_ADMIN_ENDPOINTS.featureFlags} />;
}
