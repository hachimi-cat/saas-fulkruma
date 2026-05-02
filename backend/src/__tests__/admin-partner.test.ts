import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import routes from '../routes/index.js';
import { requestId } from '../middleware/auth.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.use('/api/v1', routes);
  return app;
}

describe('admin partner endpoints', () => {
  it('rejects without HMAC signature', async () => {
    const r = await request(makeApp()).get('/api/v1/admin/workspaces/anything');
    expect(r.status).toBe(401);
    expect(r.body.error?.code).toBe('AUTH_REQUIRED');
  });

  it('rejects portal-internal-secret without platform-admin scope', async () => {
    const r = await request(makeApp())
      .get('/api/v1/admin/workspaces/usr_test')
      .set('x-fulkruma-internal-secret', 'wrong')
      .set('x-fulkruma-account-id', 'usr_test');
    expect([401, 403]).toContain(r.status);
  });
});
