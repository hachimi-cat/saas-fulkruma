import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { Price } from '@forjio/website-ui';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Transparent pricing for Fulkruma. Priced in Rupiah. No per-shipment fees. International billing via PayPal. Start free, upgrade when you scale.',
};

// A7 (2026-05-18): every row reconciled with backend/src/lib/plans.ts
// (PLAN_LIMITS + PLAN_PRICES_IDR). Tier order matches Prisma
// FulkrumaPlan enum: FREE / STARTER / GROWTH / SCALE.
// USD-cents mirror backend/src/lib/plans.ts PLAN_PRICES_USD_CENTS.
const tiers = [
  {
    name: 'Free',
    idr: 0,
    usdCents: 0,
    description: 'For pilots and side projects.',
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Starter',
    idr: 299_000,
    usdCents: 1_900,
    description: 'For growing storefronts.',
    cta: 'Start Starter',
    highlight: true,
  },
  {
    name: 'Growth',
    idr: 799_000,
    usdCents: 4_900,
    description: 'For multi-warehouse merchants.',
    cta: 'Start Growth',
    highlight: false,
  },
  {
    name: 'Scale',
    idr: 1_999_000,
    usdCents: 12_900,
    description: 'For high-volume operators.',
    cta: 'Start Scale',
    highlight: false,
  },
];

const comparisonRows: Array<{
  feature: string;
  values: [string | boolean, string | boolean, string | boolean, string | boolean];
}> = [
  { feature: 'Fulfilled orders / month', values: ['50', '500', '5,000', 'Unlimited'] },
  { feature: 'Warehouses', values: ['1', '3', '10', 'Unlimited'] },
  { feature: 'License keys', values: ['—', '100', '5,000', 'Unlimited'] },
  { feature: 'API keys', values: ['1', '5', '25', 'Unlimited'] },
  { feature: 'Webhook endpoints', values: ['1', '5', '25', 'Unlimited'] },
  { feature: 'API rate limit', values: ['60 req/min', '600 req/min', '2,000 req/min', '5,000 req/min'] },
  { feature: 'Biteship shipments / month', values: ['50', '500', '5,000', 'Unlimited'] },
  { feature: 'Biteship couriers', values: [true, true, true, true] },
  { feature: 'Cross-warehouse stock transfers', values: [false, false, true, true] },
  { feature: 'Reservations + low-stock alerts', values: [false, true, true, true] },
  { feature: 'License keys + activations', values: [false, true, true, true] },
  { feature: 'API + CLI access', values: [true, true, true, true] },
  { feature: 'SDKs (Node / Python / Go)', values: [true, true, true, true] },
  { feature: 'Email support', values: [true, true, true, true] },
  { feature: 'Priority support', values: [false, false, true, true] },
  { feature: 'Payment methods (IDR)', values: ['—', 'QRIS · VA · e-wallet · card', 'QRIS · VA · e-wallet · card', 'QRIS · VA · e-wallet · card'] },
  { feature: 'Payment methods (USD intl)', values: ['—', 'PayPal', 'PayPal', 'PayPal'] },
];

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-primary" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  return <span className="text-sm">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Priced in Rupiah. No per-shipment fees.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Storlaunch storefronts get Fulkruma at Storlaunch&apos;s bundled rate via the
          Pattern 2 partner-billing model. Stand-alone? Pick a plan below.
        </p>
      </div>

      {/* Tier Cards */}
      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative rounded-lg border p-6 ${
              tier.highlight
                ? 'border-primary shadow-lg shadow-primary/10'
                : 'border-border'
            }`}
          >
            {tier.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                Most popular
              </span>
            )}
            <h2 className="text-xl font-bold">{tier.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
            <p className="mt-6 text-3xl font-bold tabular-nums">
              <Price idr={tier.idr} usdCents={tier.usdCents} />
              {tier.idr > 0 && (
                <span className="text-base font-normal text-muted-foreground">
                  /mo
                </span>
              )}
            </p>
            <Link
              href="/login"
              className={`mt-8 block rounded-md py-2.5 text-center text-sm font-medium transition ${
                tier.highlight
                  ? 'bg-primary text-primary-foreground hover:bg-brand-600'
                  : 'border border-border hover:bg-accent'
              }`}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        All plans IDR-primary. Annual billing = 2 months free. International
        customers pay in USD via PayPal — Midtrans doesn&apos;t process USD.
      </p>

      {/* Feature Comparison */}
      <div className="mt-20">
        <h2 className="text-center text-2xl font-bold">Feature comparison</h2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-4 pr-6 text-sm font-medium text-muted-foreground">
                  Feature
                </th>
                <th className="pb-4 text-center text-sm font-medium">Free</th>
                <th className="pb-4 text-center text-sm font-medium text-primary">
                  Starter
                </th>
                <th className="pb-4 text-center text-sm font-medium">Growth</th>
                <th className="pb-4 text-center text-sm font-medium">Scale</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="border-b border-border/50">
                  <td className="py-4 pr-6 text-sm">{row.feature}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="py-4 text-center">
                      <CellValue value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
