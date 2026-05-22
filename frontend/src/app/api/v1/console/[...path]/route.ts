import { bffProxy } from '@/lib/bff-proxy';

// Admin data proxy → Fulkruma backend BFF (see lib/bff-proxy.ts).
// Mounted at /api/v1/console/ — deliberately NOT /api/v1/admin/, which
// would collide with the backend's own partner-billing admin routes.
// Stamps X-Fulkruma-Role: admin so the backend resolves the admin
// session and `adminGuard` accepts it. The shared-secret / HMAC paths
// keep working independently.
const handle = bffProxy('admin');

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
