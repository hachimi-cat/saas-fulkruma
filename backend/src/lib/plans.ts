/**
 * Fulkruma plan limits + IDR pricing — matches forjio-architecture/PRICING.md.
 * Plan keys mirror the Prisma FulkrumaPlan enum.
 */
export const PLAN_LIMITS = {
  FREE: {
    ordersPerMonth: 50,
    warehouses: 1,
    licenseKeys: 0,
    apiKeysAllowed: 1,
    webhookEndpoints: 1,
    rateLimit: 60,
    biteshipShipments: 50,
  },
  STARTER: {
    ordersPerMonth: 500,
    warehouses: 3,
    licenseKeys: 100,
    apiKeysAllowed: 5,
    webhookEndpoints: 5,
    rateLimit: 600,
    biteshipShipments: 500,
  },
  GROWTH: {
    ordersPerMonth: 5_000,
    warehouses: 10,
    licenseKeys: 5_000,
    apiKeysAllowed: 25,
    webhookEndpoints: 25,
    rateLimit: 2000,
    biteshipShipments: 5_000,
  },
  SCALE: {
    ordersPerMonth: Infinity,
    warehouses: Infinity,
    licenseKeys: Infinity,
    apiKeysAllowed: Infinity,
    webhookEndpoints: Infinity,
    rateLimit: 5000,
    biteshipShipments: Infinity,
  },
} as const;

export const PLAN_PRICES_IDR = {
  FREE: 0,
  STARTER: 299_000,
  GROWTH: 799_000,
  SCALE: 1_999_000,
} as const;

/** USD prices in cents. International (non-Indonesia) merchants are
 *  billed in USD via PayPal through Plugipay-self's shared adapter
 *  ("all forjio using 1 plugipay paypal" — bang 2026-05-19). Conversion
 *  ~Rp 16k/USD, rounded to clean dollars. */
export const PLAN_PRICES_USD_CENTS = {
  FREE: 0,
  STARTER: 1900,   // $19
  GROWTH: 4900,    // $49
  SCALE: 12900,    // $129
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

const UNLIMITED = {
  ordersPerMonth: Infinity,
  warehouses: Infinity,
  licenseKeys: Infinity,
  apiKeysAllowed: Infinity,
  webhookEndpoints: Infinity,
  rateLimit: 10_000,
  biteshipShipments: Infinity,
} as const;

export function getLimits(
  plan: PlanKey | string,
  opts?: { isForjioInternal?: boolean },
): typeof PLAN_LIMITS[PlanKey] | typeof UNLIMITED {
  if (opts?.isForjioInternal) return UNLIMITED;
  return PLAN_LIMITS[plan as PlanKey] ?? PLAN_LIMITS.FREE;
}
