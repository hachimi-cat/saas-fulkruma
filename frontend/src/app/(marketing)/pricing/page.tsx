import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Transparent pricing for Fulkruma. Priced in Rupiah. No per-shipment fees. Start free, upgrade when you scale.',
};

const tiers = [
  {
    name: 'Free',
    price: 'Rp 0',
    period: '',
    description: 'For pilots and side projects.',
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Starter',
    price: 'Rp 299K',
    period: '/mo',
    description: 'For growing storefronts.',
    cta: 'Start Starter',
    highlight: true,
  },
  {
    name: 'Growth',
    price: 'Rp 799K',
    period: '/mo',
    description: 'For multi-warehouse merchants.',
    cta: 'Start Growth',
    highlight: false,
  },
  {
    name: 'Scale',
    price: 'Rp 1.999K',
    period: '/mo',
    description: 'For high-volume operators.',
    cta: 'Talk to sales',
    highlight: false,
  },
];

const comparisonRows = [
  { feature: 'Warehouses', free: '1', starter: '3', growth: '10', scale: 'Unlimited' },
  { feature: 'Fulfilled orders / mo', free: '50', starter: '500', growth: '5,000', scale: '50,000' },
  { feature: 'Biteship couriers', free: true, starter: true, growth: true, scale: true },
  { feature: 'Multi-region routing', free: false, starter: false, growth: true, scale: true },
  { feature: 'Reservations + low-stock alerts', free: false, starter: true, growth: true, scale: true },
  { feature: 'License keys', free: false, starter: true, growth: true, scale: true },
  { feature: 'Custom courier rates', free: false, starter: false, growth: false, scale: true },
  { feature: 'API + CLI access', free: true, starter: true, growth: true, scale: true },
  { feature: 'SDKs (Node / Python / Go)', free: true, starter: true, growth: true, scale: true },
  { feature: 'Email support', free: true, starter: true, growth: true, scale: true },
  { feature: 'Priority support', free: false, starter: false, growth: true, scale: true },
  { feature: 'SLA', free: false, starter: false, growth: false, scale: true },
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
              {tier.price}
              {tier.period && (
                <span className="text-base font-normal text-muted-foreground">
                  {tier.period}
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
        All plans IDR-primary. Annual billing = 2 months free.
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
                  <td className="py-4 text-center">
                    <CellValue value={row.free} />
                  </td>
                  <td className="py-4 text-center">
                    <CellValue value={row.starter} />
                  </td>
                  <td className="py-4 text-center">
                    <CellValue value={row.growth} />
                  </td>
                  <td className="py-4 text-center">
                    <CellValue value={row.scale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
