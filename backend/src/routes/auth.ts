import { createAuthRouter } from '@forjio/sdk/auth-server';
import { authConfig } from '../auth-config.js';

// BFF migration (F-AUTH): the Huudis SSO routes — /api/v1/auth/* —
// now come from the shared @forjio/sdk/auth-server kit. The
// product-specific bits live in ../auth-config.ts.
export default createAuthRouter(authConfig);
