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

describe('GET /api/v1/health', () => {
  it('returns envelope with service + status', async () => {
    const res = await request(makeApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.service).toBeDefined();
    expect(res.body.meta.requestId).toMatch(/^req_/);
    expect(res.body.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
