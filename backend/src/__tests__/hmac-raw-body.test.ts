import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';
import { requestId } from '../middleware/auth.js';

/**
 * hmacAuth used to hash only the body as re-serialised on the server
 * (JSON.stringify(req.body), {} as ''), so a request whose client signed the bytes
 * it sent failed with BAD_SIGNATURE whenever those differed: Python's escaped
 * non-ASCII text, a float like 1.0, Go's escaped <>&, an empty {} body (the SDKs'
 * licenses.revoke, apiKeys.revoke, billing.cancel). It now accepts a signature over
 * the raw bytes (kept by express.json in index.ts) or, as before, the re-serialised body.
 */

// vi.mock is hoisted above every top-level statement, so the doubles have to be
// created inside vi.hoisted or the factory closes over a TDZ binding.
const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../lib/db.js', () => ({ prisma: { apiKey: { findUnique, update } } }));

const { hmacAuth } = await import('../middleware/hmac-auth.js');

const KEY_ID = 'AKIAFULKTEST0000';
const SECRET = 'fulksk_test_secret_value';
findUnique.mockResolvedValue({
  id: 'k1', keyId: KEY_ID, secretHash: SECRET, scopes: ['read', 'write'],
  accountId: 'acc_owner', revokedAt: null, partner: null,
});

// The server as index.ts builds it: express.json keeps the raw bytes.
function app() {
  const a = express();
  a.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as express.Request).rawBody = Buffer.from(buf); } }));
  a.use(requestId);
  a.post('/api/v1/probe', hmacAuth, (req, res) => res.json({ accountId: req.auth?.accountId, body: req.body }));
  a.get('/api/v1/probe', hmacAuth, (req, res) => res.json({ accountId: req.auth?.accountId }));
  return a;
}

function signature(method: string, path: string, signedBody: string, ts: number) {
  const bodyHash = crypto.createHash('sha256').update(Buffer.from(signedBody, 'utf8')).digest('hex');
  return crypto.createHmac('sha256', SECRET).update(`${method}\n${path}\n${ts}\n${bodyHash}`).digest('hex');
}

function post(raw: string | null, signedOver: string) {
  const ts = Math.floor(Date.now() / 1000);
  const req = request(app())
    .post('/api/v1/probe')
    .set('Authorization', `Fulkruma-HMAC-SHA256 keyId=${KEY_ID}, scope=*, signature=${signature('POST', '/api/v1/probe', signedOver, ts)}`)
    .set('X-Fulkruma-Timestamp', String(ts));
  return raw === null ? req : req.set('Content-Type', 'application/json').send(raw);
}

describe('hmacAuth — a signature over the bytes the client sent', () => {
  for (const [label, raw] of [
    ['non-ASCII text, as Python sends it escaped', '{"name":"caf\\u00e9"}'],
    ['non-ASCII text, raw UTF-8', '{"name":"café — 日本"}'],
    ['a float like 1.0', '{"weight":1.0}'],
    ['<, > and & as Go escapes them', '{"note":"\\u003cb\\u003e \\u0026"}'],
    ['an empty object', '{}'],
    ['spaces after separators', '{"a": 1, "b": [1, 2]}'],
  ] as const) {
    it(`accepts ${label}`, async () => {
      const res = await post(raw, raw);
      expect(res.status).toBe(200);
      expect(res.body.accountId).toBe('acc_owner');
    });
  }

  it('accepts a request with no body, signed over nothing', async () => {
    expect((await post(null, '')).status).toBe(200);
  });

  it('still accepts the body as re-serialised here (the old recipe)', async () => {
    expect((await post('{"weight": 1.0}', '{"weight":1}')).status).toBe(200);
    expect((await post('{}', '')).status).toBe(200);
  });

  it('still rejects bytes other than the ones signed', async () => {
    const res = await post('{"weight":2}', '{"weight":1}');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('BAD_SIGNATURE');
  });

  it('still signs the path with its query string', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const path = '/api/v1/probe?limit=5';
    const ok = await request(app())
      .get(path)
      .set('Authorization', `Fulkruma-HMAC-SHA256 keyId=${KEY_ID}, scope=*, signature=${signature('GET', path, '', ts)}`)
      .set('X-Fulkruma-Timestamp', String(ts));
    expect(ok.status).toBe(200);
    const bad = await request(app())
      .get('/api/v1/probe?limit=6')
      .set('Authorization', `Fulkruma-HMAC-SHA256 keyId=${KEY_ID}, scope=*, signature=${signature('GET', path, '', ts)}`)
      .set('X-Fulkruma-Timestamp', String(ts));
    expect(bad.status).toBe(401);
  });
});
