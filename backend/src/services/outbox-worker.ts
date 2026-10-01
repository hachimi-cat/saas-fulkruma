import { prisma } from '../lib/db.js';
import { fanOutEvent, signWebhookBody, SIGNATURE_HEADER } from './webhook-delivery.js';

/**
 * Outbox polling worker — ADR-0006.
 *
 * Reads unpublished `outbox_events` and hands each one to its two kinds
 * of consumer:
 *
 *  - merchants' own webhook endpoints: `fanOutEvent` queues one
 *    delivery per matching endpoint of the event's account; the
 *    deliveries themselves (signing, retries, the delivery log) run in
 *    services/webhook-delivery.ts, so a slow merchant endpoint never
 *    holds this loop up;
 *  - partner products, set in env. F-008 wires the first one:
 *    storlaunch receives `fulkruma.shipment.status_updated.v1` so its
 *    ManualOrder rows mirror Biteship-driven status changes (driver
 *    picked, in transit, delivered) without polling.
 *
 * Configuration:
 *   STORLAUNCH_WEBHOOK_URL   — POST target (e.g. https://storlaunch.com/api/v1/webhooks/fulkruma)
 *   FULKRUMA_OUTBOX_SECRET   — HMAC shared secret; must match storlaunch's verify side
 *
 * If either env is missing, the partner step is a no-op (dev) and
 * events still get marked as published so the queue doesn't
 * accumulate. A failing partner leaves the event unpublished: it is
 * handled again on the next poll.
 */

const POLL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1000);
const BATCH = Number(process.env.OUTBOX_BATCH_SIZE ?? 100);

let stopped = false;

export async function startOutboxWorker() {
  console.log(`[outbox] polling every ${POLL_MS}ms, batch=${BATCH}`);
  while (!stopped) {
    try {
      await processOutboxBatch();
    } catch (e) {
      console.error('[outbox] loop error', e);
    }
    await sleep(POLL_MS);
  }
}

/** One pass of the loop: every unpublished event, oldest first. */
export async function processOutboxBatch(): Promise<number> {
  const batch = await prisma.outboxEvent.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  });
  for (const ev of batch) {
    await deliver(ev);
  }
  return batch.length;
}

export function stopOutboxWorker() {
  stopped = true;
}

type OutboxRow = {
  id: string;
  type: string;
  accountId: string | null;
  occurredAt: Date;
  data: unknown;
  metadata: unknown;
};

async function deliver(ev: OutboxRow) {
  // Merchant endpoints first. Queuing is idempotent per (endpoint,
  // event), so when a partner delivery below fails and this event is
  // handled again on the next poll, nothing is queued twice. If the
  // queuing itself fails, the event stays unpublished and is retried.
  try {
    await fanOutEvent(ev);
  } catch (e) {
    console.error(`[outbox] webhook fan-out failed for ${ev.id}:`, (e as Error).message);
    return;
  }

  const targets = subscribersFor(ev.type);
  for (const target of targets) {
    try {
      await postSigned(target.url, target.secret, {
        id: ev.id,
        type: ev.type,
        occurredAt: ev.occurredAt.toISOString(),
        accountId: ev.accountId,
        data: ev.data,
        metadata: ev.metadata ?? {},
      });
    } catch (e) {
      console.error(`[outbox] delivery failed type=${ev.type} target=${target.url}:`, (e as Error).message);
      // Don't mark as published on failure — next poll retries.
      return;
    }
  }
  await prisma.outboxEvent.update({
    where: { id: ev.id },
    data: { publishedAt: new Date() },
  });
}

// The PARTNER consumers of fulkruma's shipment lifecycle. (Merchant
// endpoints get every type they subscribe to — fanOutEvent above.)
// Adding an event type to buildEvent() is NOT enough for a partner — a
// type missing here never reaches storlaunch / malapos, so every new
// type they consume has to be listed.
const SHIPMENT_EVENT_TYPES = new Set([
  'fulkruma.shipment.status_updated.v1',
  'fulkruma.shipment.pickup_confirmed.v1',
  // Cancel + rebook raised anywhere other than the partner's own proxy
  // (fulkruma's dashboard, a direct API client). The proxy path already
  // repoints the order inline; these keep the out-of-band paths honest.
  'fulkruma.shipment.cancelled.v1',
  'fulkruma.shipment.rebooked.v1',
]);

function subscribersFor(type: string): Array<{ url: string; secret: string }> {
  const out: Array<{ url: string; secret: string }> = [];
  // F-008: storlaunch subscribes to shipment + delivery events.
  if (SHIPMENT_EVENT_TYPES.has(type)) {
    const secret = process.env.FULKRUMA_OUTBOX_SECRET;
    const url = process.env.STORLAUNCH_WEBHOOK_URL;
    if (url && secret) out.push({ url, secret });
    // Malapos runs the same consumer shape at /api/v1/webhooks/fulkruma.
    // Unset on the box today, so this stays a no-op until it's added.
    const malaposUrl = process.env.MALAPOS_WEBHOOK_URL;
    if (malaposUrl && secret) out.push({ url: malaposUrl, secret });
  }
  return out;
}

// Partner URLs come from our own env (often on the private network),
// so they skip the merchant-URL SSRF guard — but sign the same way.
async function postSigned(url: string, secret: string, envelope: unknown) {
  const body = JSON.stringify(envelope);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [SIGNATURE_HEADER]: signWebhookBody(secret, body),
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
