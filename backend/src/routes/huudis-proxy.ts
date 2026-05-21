import { createHuudisProxy } from '@forjio/sdk/auth-server';
import { authConfig } from '../auth-config.js';

// BFF migration (F-AUTH): the /api/v1/huudis/* IAM proxy now comes
// from the shared @forjio/sdk/auth-server kit.
export default createHuudisProxy(authConfig);
