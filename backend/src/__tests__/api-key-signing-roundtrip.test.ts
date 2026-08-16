import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A key minted by POST /api-keys must be usable to sign a request.
 *
 * `routes/api-keys.ts` stored `sha256Hex(secret)` in `secretHash`, while
 * `middleware/hmac-auth.ts` uses that column RAW as the HMAC key — its
 * comment even says "we just put the raw secret in `secretHash` going
 * forward". The handler never followed, so the server signed with the
 * hash and every client signed with the secret: no key minted through
 * the API could ever authenticate. Nobody noticed because the working
 * partner keys were seeded directly.
 *
 * Found 2026-08-16 while auditing ripllo, which had the identical bug.
 */
describe('minted API keys can sign', () => {
  const src = readFileSync(join(__dirname, '..', 'routes', 'api-keys.ts'), 'utf8');

  it('persists the secret in the form hmac-auth uses as the key', () => {
    const createBlock = src.slice(src.indexOf('prisma.apiKey.create'), src.indexOf('prisma.apiKey.create') + 1200);
    expect(createBlock, 'apiKey.create not found').not.toBe('');
    expect(/secretHash:\s*secret\b/.test(createBlock), 'secretHash must persist the raw secret').toBe(true);
    expect(/secretHash:\s*sha256Hex\(/.test(createBlock), 'storing a hash breaks every minted key').toBe(false);
  });

  it('hmac-auth still uses the column directly — the other half of the contract', () => {
    const auth = readFileSync(join(__dirname, '..', 'middleware', 'hmac-auth.ts'), 'utf8');
    expect(/createHmac\('sha256',\s*key\.secretHash\)/.test(auth)).toBe(true);
  });

  it('round-trips: signing with the handed-out secret verifies against the stored column', () => {
    const secret = 'fulksk_example_value';
    const stored = secret; // what the handler now writes
    const ts = Math.floor(Date.now() / 1000);
    const bodyHash = crypto.createHash('sha256').update('').digest('hex');
    const stringToSign = `GET\n/api/v1/probe\n${ts}\n${bodyHash}`;
    const client = crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
    const server = crypto.createHmac('sha256', stored).update(stringToSign).digest('hex');
    expect(server).toBe(client);

    // Control: the old behaviour must NOT verify, or this test proves nothing.
    const oldStored = crypto.createHash('sha256').update(secret).digest('hex');
    expect(crypto.createHmac('sha256', oldStored).update(stringToSign).digest('hex')).not.toBe(client);
  });
});
