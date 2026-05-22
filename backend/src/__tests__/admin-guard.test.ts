import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';
import { requestId } from '../middleware/auth.js';

// admin-guard reads FULKRUMA_FORJIO_ADMIN_SECRET + the auth config at
// module load via the SDK, so the env must be set before import.
const SECRET = 'test-forjio-admin-secret';
process.env.FULKRUMA_FORJIO_ADMIN_SECRET = SECRET;

function makeApp(guard: express.RequestHandler) {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.get('/admin/probe', guard, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('adminGuard — session-or-secret-or-hmac', () => {
  let adminGuard: express.RequestHandler;

  beforeAll(async () => {
    ({ adminGuard } = await import('../middleware/admin-guard.js'));
  });

  it('401s with no credentials', async () => {
    const res = await request(makeApp(adminGuard)).get('/admin/probe');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('401s with a wrong admin secret', async () => {
    const res = await request(makeApp(adminGuard))
      .get('/admin/probe')
      .set('x-forjio-admin-secret', 'nope-wrong-secret');
    expect(res.status).toBe(401);
  });

  it('allows the cross-product admin proxy with the matching admin secret', async () => {
    const res = await request(makeApp(adminGuard))
      .get('/admin/probe')
      .set('x-forjio-admin-secret', SECRET);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('401s with a bogus admin session cookie (bad signature)', async () => {
    const res = await request(makeApp(adminGuard))
      .get('/admin/probe')
      .set('x-fulkruma-role', 'admin')
      .set('Cookie', 'fulkruma_admin_session=not-a-valid-signed-session');
    expect(res.status).toBe(401);
  });

  it('does not leak access when secret env is set but header uses a length-mismatched value', async () => {
    const res = await request(makeApp(adminGuard))
      .get('/admin/probe')
      .set('x-forjio-admin-secret', crypto.randomBytes(8).toString('hex'));
    expect(res.status).toBe(401);
  });
});
