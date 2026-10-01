/**
 * fulkruma.delivery.expired.v1 — a digital delivery's download window closed: its
 * `expiresAt` passed, or it was revoked (revoke sets `expiresAt` to now).
 *
 * Nothing checks expiry at that moment, so a sweep finds the deliveries whose
 * `expiresAt` has passed and whose expiry was not told yet (`expiryNotifiedAt` null),
 * and for each, in one transaction, CLAIMS the row (a conditional update, so two
 * processes never announce one expiry twice) and writes the outbox event. Extending
 * a delivery clears `expiryNotifiedAt`, so its next expiry is told again.
 *
 * `startDeliveryExpiryWorker` runs the sweep every DELIVERY_EXPIRY_POLL_MS (60 s)
 * next to the outbox and webhook workers (index.ts).
 */
import { prisma } from '../lib/db.js';
import { buildEvent } from '../lib/events.js';

const BATCH = Number(process.env.DELIVERY_EXPIRY_BATCH ?? 200);

/** Announce every delivery that has expired since its last announcement (only one
 *  account's with `accountId`). Returns how many. */
export async function notifyExpiredDeliveries(now = new Date(), opts: { accountId?: string } = {}): Promise<number> {
  const due = await prisma.delivery.findMany({
    where: { expiryNotifiedAt: null, expiresAt: { lte: now }, ...(opts.accountId ? { accountId: opts.accountId } : {}) },
    orderBy: { expiresAt: 'asc' },
    take: BATCH,
  });
  let told = 0;
  for (const d of due) {
    const claimed = await prisma.$transaction(async (tx) => {
      const claim = await tx.delivery.updateMany({
        where: { id: d.id, expiryNotifiedAt: null, expiresAt: { lte: now } },
        data: { expiryNotifiedAt: now },
      });
      if (claim.count !== 1) return false;
      await tx.outboxEvent.create({
        data: buildEvent({
          type: 'fulkruma.delivery.expired.v1',
          accountId: d.accountId,
          data: {
            deliveryId: d.id,
            productId: d.productId,
            customerId: d.customerId,
            checkoutSessionId: d.checkoutSessionId,
            expiresAt: d.expiresAt.toISOString(),
            downloadCount: d.downloadCount,
            maxDownloads: d.maxDownloads,
          },
        }),
      });
      return true;
    });
    if (claimed) told++;
  }
  return told;
}

const POLL_MS = Number(process.env.DELIVERY_EXPIRY_POLL_MS ?? 60_000);
let stopped = false;

export async function startDeliveryExpiryWorker(): Promise<void> {
  console.log(`[deliveries] expiry sweep every ${POLL_MS}ms`);
  while (!stopped) {
    try {
      const n = await notifyExpiredDeliveries();
      if (n) console.log(`[deliveries] announced ${n} expired deliveries`);
    } catch (e) {
      console.error('[deliveries] expiry sweep error', e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

export function stopDeliveryExpiryWorker(): void {
  stopped = true;
}
