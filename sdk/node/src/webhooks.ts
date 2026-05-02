import crypto from 'node:crypto';
import { WebhookEventEnvelope } from './types.js';

/**
 * Verify an inbound Fulkruma webhook signature.
 *
 * Header: `Fulkruma-Signature: t=<unix>,v1=<hex>`
 * Payload signed: `${t}.${rawBody}` with HMAC-SHA256 keyed on the
 * endpoint's shared secret.
 *
 * Returns the parsed event envelope on success, throws on bad signature
 * or replay (timestamp older than `toleranceSec`, default 5 min).
 */
export function verifyWebhook<T = unknown>(opts: {
  rawBody: string | Buffer;
  signature: string | undefined | null;
  secret: string;
  toleranceSec?: number;
}): WebhookEventEnvelope<T> {
  if (!opts.signature) throw new Error('missing Fulkruma-Signature header');
  const tolerance = opts.toleranceSec ?? 300;

  const parts: Record<string, string> = {};
  for (const segment of opts.signature.split(',')) {
    const [k, v] = segment.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) throw new Error('malformed signature header');

  const tsNum = Number.parseInt(ts, 10);
  if (!Number.isFinite(tsNum)) throw new Error('non-numeric timestamp');
  const drift = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
  if (drift > tolerance) throw new Error(`signature timestamp ${drift}s out of tolerance`);

  const bodyStr = typeof opts.rawBody === 'string' ? opts.rawBody : opts.rawBody.toString('utf8');
  const expected = crypto.createHmac('sha256', opts.secret).update(`${ts}.${bodyStr}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const givenBuf = Buffer.from(v1, 'utf8');
  if (expectedBuf.length !== givenBuf.length || !crypto.timingSafeEqual(expectedBuf, givenBuf)) {
    throw new Error('bad signature');
  }

  let event: WebhookEventEnvelope<T>;
  try {
    event = JSON.parse(bodyStr) as WebhookEventEnvelope<T>;
  } catch {
    throw new Error('webhook body is not valid JSON');
  }
  return event;
}
