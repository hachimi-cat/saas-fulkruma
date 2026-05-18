import crypto from 'node:crypto';
import { prisma } from '../lib/db.js';

/**
 * Outbox polling worker — ADR-0006.
 *
 * Reads unpublished `outbox_events` and fans them out to subscribed
 * services. F-008 wires the first real delivery target: storlaunch
 * receives `fulkruma.shipment.status_updated.v1` so its ManualOrder
 * rows mirror Biteship-driven status changes (driver picked, in
 * transit, delivered) without polling.
 *
 * Configuration:
 *   STORLAUNCH_WEBHOOK_URL   — POST target (e.g. https://storlaunch.com/api/v1/webhooks/fulkruma)
 *   FULKRUMA_OUTBOX_SECRET   — HMAC shared secret; must match storlaunch's verify side
 *
 * If either env is missing, events still get marked as published (no-op
 * mode for dev) so the queue doesn't accumulate.
 */

const POLL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1000);
const BATCH = Number(process.env.OUTBOX_BATCH_SIZE ?? 100);

let stopped = false;

export async function startOutboxWorker() {
  console.log(`[outbox] polling every ${POLL_MS}ms, batch=${BATCH}`);
  while (!stopped) {
    try {
      const batch = await prisma.outboxEvent.findMany({
        where: { publishedAt: null },
        orderBy: { createdAt: 'asc' },
        take: BATCH,
      });
      for (const ev of batch) {
        await deliver(ev);
      }
    } catch (e) {
      console.error('[outbox] loop error', e);
    }
    await sleep(POLL_MS);
  }
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

function subscribersFor(type: string): Array<{ url: string; secret: string }> {
  const out: Array<{ url: string; secret: string }> = [];
  // F-008: storlaunch subscribes to shipment + delivery events.
  if (
    type === 'fulkruma.shipment.status_updated.v1'
    || type === 'fulkruma.shipment.pickup_confirmed.v1'
  ) {
    const url = process.env.STORLAUNCH_WEBHOOK_URL;
    const secret = process.env.FULKRUMA_OUTBOX_SECRET;
    if (url && secret) out.push({ url, secret });
  }
  return out;
}

async function postSigned(url: string, secret: string, envelope: unknown) {
  const body = JSON.stringify(envelope);
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Fulkruma-Signature': `t=${ts},v1=${sig}`,
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
