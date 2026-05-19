import { prisma } from '../lib/db.js';
import { PLAN_LIMITS, PLAN_PRICES_IDR, getLimits, type PlanKey } from '../lib/plans.js';

export function listPlans() {
  return [
    {
      id: 'free',
      name: 'Free',
      price: PLAN_PRICES_IDR.FREE,
      currency: 'IDR',
      features: [
        `${PLAN_LIMITS.FREE.ordersPerMonth} orders/month`,
        `${PLAN_LIMITS.FREE.warehouses} warehouse`,
        'Biteship couriers',
        'Email support',
      ],
    },
    {
      id: 'starter',
      name: 'Starter',
      price: PLAN_PRICES_IDR.STARTER,
      currency: 'IDR',
      features: [
        `${PLAN_LIMITS.STARTER.ordersPerMonth.toLocaleString()} orders/month`,
        `${PLAN_LIMITS.STARTER.warehouses} warehouses`,
        'Reservations + low-stock alerts',
        `${PLAN_LIMITS.STARTER.licenseKeys.toLocaleString()} license keys`,
      ],
    },
    {
      id: 'growth',
      name: 'Growth',
      price: PLAN_PRICES_IDR.GROWTH,
      currency: 'IDR',
      features: [
        `${PLAN_LIMITS.GROWTH.ordersPerMonth.toLocaleString()} orders/month`,
        `${PLAN_LIMITS.GROWTH.warehouses} warehouses`,
        'Cross-warehouse stock transfers',
        'Priority support',
      ],
    },
    {
      id: 'scale',
      name: 'Scale',
      price: PLAN_PRICES_IDR.SCALE,
      currency: 'IDR',
      features: [
        'Unlimited warehouses',
        'Unlimited orders',
        'Custom courier rates',
        'SLA',
      ],
    },
  ];
}

export async function getEffectivePlan(accountId: string): Promise<PlanKey> {
  const sub = await prisma.subscription.findUnique({ where: { accountId } });
  if (!sub) return 'FREE';
  const plan = (sub.plan ?? 'FREE') as PlanKey;
  if (plan === 'FREE') return 'FREE';
  const now = new Date();
  const expired =
    (sub.currentPeriodEnd && sub.currentPeriodEnd < now) ||
    (sub.cancelAt && sub.cancelAt < now);
  if (expired) {
    await prisma.subscription.update({
      where: { accountId },
      data: { plan: 'FREE', status: 'CANCELED', cancelAt: null },
    });
    return 'FREE';
  }
  return plan;
}

export async function getCurrentPlan(accountId: string, isForjioInternal = false) {
  const sub = await prisma.subscription.findUnique({ where: { accountId } });
  const plan = (sub?.plan ?? 'FREE') as PlanKey;
  const limits = getLimits(plan, { isForjioInternal });
  return {
    plan: isForjioInternal ? 'forjio_internal' : plan.toLowerCase(),
    planName: isForjioInternal ? 'Forjio Internal' : plan.charAt(0) + plan.slice(1).toLowerCase(),
    isForjioInternal,
    ordersLimit: limits.ordersPerMonth === Infinity ? -1 : limits.ordersPerMonth,
    warehousesLimit: limits.warehouses === Infinity ? -1 : limits.warehouses,
    licenseKeysLimit: limits.licenseKeys === Infinity ? -1 : limits.licenseKeys,
    apiKeysLimit: limits.apiKeysAllowed === Infinity ? -1 : limits.apiKeysAllowed,
    webhookEndpointsLimit: limits.webhookEndpoints === Infinity ? -1 : limits.webhookEndpoints,
    rateLimit: limits.rateLimit,
    biteshipShipmentsLimit: limits.biteshipShipments === Infinity ? -1 : limits.biteshipShipments,
    billingCycleEnd: sub?.currentPeriodEnd ?? null,
  };
}

export async function getSubscriptionView(accountId: string, isForjioInternal = false) {
  const sub = await prisma.subscription.findUnique({ where: { accountId } });
  const plan = (sub?.plan ?? 'FREE') as PlanKey;
  return {
    plan: isForjioInternal ? 'forjio_internal' : plan.toLowerCase(),
    planName: isForjioInternal ? 'Forjio Internal' : plan.charAt(0) + plan.slice(1).toLowerCase(),
    isForjioInternal,
    status: (sub?.status ?? 'ACTIVE').toLowerCase(),
    currentPeriodStart: sub?.currentPeriodStart ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAt: sub?.cancelAt ?? null,
  };
}

export async function getUsage(accountId: string, isForjioInternal = false) {
  const sub = await prisma.subscription.findUnique({ where: { accountId } });
  const plan = (sub?.plan ?? 'FREE') as PlanKey;
  const limits = getLimits(plan, { isForjioInternal });
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const usage = await prisma.monthlyUsage.findUnique({
    where: { accountId_year_month: { accountId, year, month } },
  });
  return {
    plan: plan.toLowerCase(),
    ordersFulfilled: usage?.ordersFulfilled ?? 0,
    ordersLimit: limits.ordersPerMonth === Infinity ? -1 : limits.ordersPerMonth,
    shipmentsCreated: usage?.shipmentsCreated ?? 0,
    licensesIssued: usage?.licensesIssued ?? 0,
    resetAt: new Date(year, month, 1).toISOString(),
  };
}

export async function getBillingHistory(accountId: string, opts: { cursor?: string; limit?: number } = {}) {
  const limit = Math.min(opts.limit ?? 20, 50);
  const findArgs: { where: { accountId: string }; take: number; orderBy: { createdAt: 'desc' }; cursor?: { id: string }; skip?: number } = {
    where: { accountId },
    take: limit + 1,
    orderBy: { createdAt: 'desc' },
  };
  if (opts.cursor) {
    findArgs.cursor = { id: opts.cursor };
    findArgs.skip = 1;
  }
  const invoices = await prisma.invoice.findMany(findArgs);
  const items = invoices.slice(0, limit);
  const hasMore = invoices.length > limit;
  return {
    data: items.map((i) => ({
      id: i.id,
      plan: i.plan.toLowerCase(),
      amount: i.amount,
      currency: i.currency,
      status: i.status,
      paidAt: i.paidAt,
      receiptUrl: i.receiptUrl,
      createdAt: i.createdAt,
    })),
    cursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
    hasMore,
  };
}
