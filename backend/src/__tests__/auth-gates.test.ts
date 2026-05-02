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

describe('auth-gated routes reject without bearer', () => {
  const cases = [
    'GET /api/v1/warehouses',
    'POST /api/v1/warehouses',
    'GET /api/v1/addresses',
    'POST /api/v1/addresses',
    'GET /api/v1/stock/levels',
    'POST /api/v1/stock/adjust',
    'GET /api/v1/shipments',
    'POST /api/v1/shipments',
    'GET /api/v1/licenses',
    'POST /api/v1/licenses',
  ];
  it.each(cases)('rejects %s with 401', async (route) => {
    const [method, path] = route.split(' ') as [string, string];
    const r = method === 'GET'
      ? await request(makeApp()).get(path)
      : await request(makeApp()).post(path).send({});
    expect(r.status).toBe(401);
    expect(r.body.error?.code).toBe('AUTH_REQUIRED');
  });
});

describe('license activation is unauthenticated', () => {
  it('400s on missing fields without requiring a bearer', async () => {
    const r = await request(makeApp()).post('/api/v1/licenses/activate').send({});
    expect(r.status).toBe(400);
    expect(r.body.error?.code).toBe('VALIDATION');
  });
});
