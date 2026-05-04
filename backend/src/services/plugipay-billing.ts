import { PlugipayClient } from '@forjio/plugipay-node';
import { prisma } from '../lib/db.js';
import type { FulkrumaPlan } from '@prisma/client';
import { PLAN_LIMITS, PLAN_PRICES_IDR, type PlanKey } from '../lib/plans.js';

// ─────────────────────────────────────────────────────────────
// Fulkruma × Plugipay billing glue.
//
// Mirrors linksnap/huudis: fulkruma is a direct Plugipay merchant. Each
// fulkruma accountId maps 1:1 to a Plugipay Customer on first checkout.
// Plan upgrades create a Plugipay Subscription + CheckoutSession; the
// Customer pays the first invoice at the hosted checkoutUrl; the
// /webhooks/plugipay handler flips the local Subscription to ACTIVE on
// invoice.paid.
//
// Env (set on fulkruma deploy):
//   PLUGIPAY_KEY_ID                fulkruma's HMAC key id on plugipay.com
//   PLUGIPAY_SECRET                the matching secret
//   PLUGIPAY_BASE_URL              default https://plugipay.com
//   PLUGIPAY_PLAN_ID_STARTER       Plugipay Plan id for fulkruma Starter
//   PLUGIPAY_PLAN_ID_GROWTH        Plugipay Plan id for fulkruma Growth
//   PLUGIPAY_PLAN_ID_SCALE         Plugipay Plan id for fulkruma Scale
// ─────────────────────────────────────────────────────────────

const PLUGIPAY_BASE_URL = process.env.PLUGIPAY_BASE_URL ?? 'https://plugipay.com';
const APP_BASE_URL = process.env.FULKRUMA_BASE_URL ?? 'https://fulkruma.com';

let platformClient: PlugipayClient | null = null;
export function getPlatformClient(): PlugipayClient {
  if (!platformClient) {
    const keyId = process.env.PLUGIPAY_KEY_ID;
    const secret = process.env.PLUGIPAY_SECRET;
    if (!keyId || !secret) {
      throw new Error('PLUGIPAY_KEY_ID + PLUGIPAY_SECRET env vars required for fulkruma billing');
    }
    platformClient = new PlugipayClient({ keyId, secret, baseUrl: PLUGIPAY_BASE_URL });
  }
  return platformClient;
}

function plugipayPlanIdForTier(tier: PlanKey): string | null {
  if (tier === 'STARTER') return process.env.PLUGIPAY_PLAN_ID_STARTER ?? null;
  if (tier === 'GROWTH') return process.env.PLUGIPAY_PLAN_ID_GROWTH ?? null;
  if (tier === 'SCALE') return process.env.PLUGIPAY_PLAN_ID_SCALE ?? null;
  return null;
}

/** Resolve or lazily create a Plugipay Customer for a fulkruma accountId. */
export async function getCustomerForAccount(accountId: string, email: string, name?: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({
    where: { accountId },
    select: { plugipayCustomerId: true },
  });
  if (sub?.plugipayCustomerId) return sub.plugipayCustomerId;

  const client = getPlatformClient();
  try {
    const customer = await client.customers.create({
      email,
      name: name ?? email,
      externalId: accountId,
      metadata: { fulkrumaAccountId: accountId },
    });
    await prisma.subscription.upsert({
      where: { accountId },
      create: { accountId, plugipayCustomerId: customer.id },
      update: { plugipayCustomerId: customer.id },
    });
    return customer.id;
  } catch (err) {
    const e = err as { status?: number };
    if (e.status === 409) {
      const page = await client.customers.list({ limit: 100, email });
      const existing = page.data.find((c) => c.externalId === accountId);
      if (existing) {
        await prisma.subscription.upsert({
          where: { accountId },
          create: { accountId, plugipayCustomerId: existing.id },
          update: { plugipayCustomerId: existing.id },
        });
        return existing.id;
      }
    }
    throw err;
  }
}

export interface StartSubscriptionResult {
  subscriptionId: string;
  invoiceId: string;
  checkoutSessionId: string;
  checkoutUrl: string;
}

/** Upgrade an account to a paid fulkruma tier via Plugipay. */
export async function startSubscription(
  accountId: string,
  email: string,
  targetTier: PlanKey,
  name?: string,
): Promise<StartSubscriptionResult> {
  if (targetTier === 'FREE') {
    throw new Error('Cannot subscribe to the FREE tier. Use cancelSubscription() instead.');
  }
  const planId = plugipayPlanIdForTier(targetTier);
  if (!planId) {
    throw new Error(`Plugipay planId not configured for tier ${targetTier}`);
  }

  const client = getPlatformClient();
  const customerId = await getCustomerForAccount(accountId, email, name);

  // Proration when switching paid tiers.
  let initialDiscount = 0;
  const existing = await prisma.subscription.findUnique({
    where: { accountId },
    select: { plugipaySubscriptionId: true, plan: true },
  });
  if (existing?.plugipaySubscriptionId && existing.plan !== 'FREE') {
    try {
      const oldSub = await client.subscriptions.get(existing.plugipaySubscriptionId);
      const oldPrice = PLAN_PRICES_IDR[existing.plan as PlanKey] ?? 0;
      const now = Date.now();
      const periodEnd = new Date(oldSub.currentPeriodEnd).getTime();
      const periodStart = new Date(oldSub.currentPeriodStart).getTime();
      const totalMs = periodEnd - periodStart;
      const unusedMs = Math.max(0, periodEnd - now);
      if (totalMs > 0) initialDiscount = Math.floor((unusedMs / totalMs) * oldPrice);
      await client.subscriptions.cancel(existing.plugipaySubscriptionId, 'now');
    } catch (e) {
      console.warn(`[fulkruma-billing] proration cancel failed:`, (e as Error).message);
    }
  }

  // Resolve active price on the plan.
  const plan = await client.plans.get(planId);
  const priceId = (plan as unknown as { prices?: { id: string; active: boolean }[] }).prices
    ?.find((p) => p.active)?.id;
  if (!priceId) throw new Error(`Plugipay plan ${planId} has no active price`);

  const subscription = await client.subscriptions.create({
    customerId,
    planId,
    priceId,
    collectionMethod: 'send_invoice',
    initialDiscount: initialDiscount > 0 ? initialDiscount : undefined,
    metadata: { fulkrumaAccountId: accountId, fulkrumaTier: targetTier },
  });

  const invoices = await client.invoices.list({ customerId, limit: 10 });
  const firstInvoice = invoices.data.find(
    (i) => (i as unknown as { subscriptionId?: string }).subscriptionId === subscription.id && i.status === 'open',
  );
  if (!firstInvoice) throw new Error('Expected auto-issued open invoice but none found');

  const chargeAmount = Math.max(0, firstInvoice.total);
  const tierName = targetTier.charAt(0) + targetTier.slice(1).toLowerCase();
  const session = await client.checkoutSessions.create({
    amount: chargeAmount,
    currency: 'IDR',
    methods: ['qris', 'va', 'ewallet', 'card'],
    successUrl: `${APP_BASE_URL}/dashboard/billing?status=success`,
    cancelUrl: `${APP_BASE_URL}/dashboard/billing?status=canceled`,
    customerId,
    lineItems: [
      {
        name: `Fulkruma ${tierName} — ${formatPeriodLabel(subscription.currentPeriodStart, subscription.currentPeriodEnd)}`,
        quantity: 1,
        unitAmount: chargeAmount,
      },
    ],
    metadata: {
      fulkrumaAccountId: accountId,
      fulkrumaTier: targetTier,
      plugipayInvoiceId: firstInvoice.id,
      plugipaySubscriptionId: subscription.id,
    },
  });

  await prisma.subscription.upsert({
    where: { accountId },
    create: { accountId, plugipayCustomerId: customerId, plugipaySubscriptionId: subscription.id },
    update: { plugipaySubscriptionId: subscription.id },
  });

  return {
    subscriptionId: subscription.id,
    invoiceId: firstInvoice.id,
    checkoutSessionId: session.id,
    checkoutUrl: (session as unknown as { checkoutUrl?: string }).checkoutUrl
      ?? `${PLUGIPAY_BASE_URL}/c/${session.id}`,
  };
}

/** Cancel a Plugipay subscription at period-end. Returns to FREE locally
 *  via the webhook handler when the period actually ends. */
export async function cancelSubscription(accountId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { accountId },
    select: { plugipaySubscriptionId: true },
  });
  if (!sub?.plugipaySubscriptionId) return;
  const client = getPlatformClient();
  try {
    await client.subscriptions.cancel(sub.plugipaySubscriptionId, 'period_end');
    await prisma.subscription.update({
      where: { accountId },
      data: { status: 'CANCELING', cancelAt: null },
    });
  } catch (e) {
    console.warn(`[fulkruma-billing] cancel failed:`, (e as Error).message);
    throw e;
  }
}

function formatPeriodLabel(start: string | Date, end: string | Date): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `${fmt(s)} → ${fmt(e)}`;
}

/** Apply a Plugipay invoice.paid webhook to the local Subscription. */
export async function applyInvoicePaid(
  accountId: string,
  targetTier: PlanKey,
  periodStart: Date,
  periodEnd: Date,
  invoice: { id: string; amount: number; currency: string; receiptUrl?: string | null },
): Promise<void> {
  if (!PLAN_LIMITS[targetTier]) return;
  await prisma.subscription.upsert({
    where: { accountId },
    create: {
      accountId,
      plan: targetTier as FulkrumaPlan,
      status: 'ACTIVE',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan: targetTier as FulkrumaPlan,
      status: 'ACTIVE',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAt: null,
    },
  });
  await prisma.invoice.upsert({
    where: { plugipayInvoiceId: invoice.id },
    create: {
      accountId,
      plugipayInvoiceId: invoice.id,
      plan: targetTier as FulkrumaPlan,
      amount: invoice.amount,
      currency: invoice.currency,
      status: 'paid',
      paidAt: new Date(),
      receiptUrl: invoice.receiptUrl ?? null,
    },
    update: {
      status: 'paid',
      paidAt: new Date(),
      amount: invoice.amount,
      receiptUrl: invoice.receiptUrl ?? null,
    },
  });
}

/** Apply a subscription.canceled webhook. */
export async function applySubscriptionCanceled(accountId: string): Promise<void> {
  await prisma.subscription.upsert({
    where: { accountId },
    create: { accountId, plan: 'FREE', status: 'CANCELED' },
    update: { plan: 'FREE', status: 'CANCELED', plugipaySubscriptionId: null },
  });
}
