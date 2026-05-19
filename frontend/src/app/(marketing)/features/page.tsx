import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Warehouse,
  Boxes,
  ArrowLeftRight,
  Truck,
  PackageCheck,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Multi-warehouse stock, soft-hold reservations, Biteship shipping, delivery tracking, license keys. Built for Indonesian storefronts.',
};

const features = [
  {
    Icon: Warehouse,
    title: 'Multi-warehouse',
    body:
      'Track stock across many locations with per-warehouse levels. Move inventory between locations with a full audit trail.',
    details: [
      'Up to 10 warehouses on Growth (unlimited on Scale)',
      'Per-warehouse stock levels and ledgers',
      'Cross-warehouse transfers (transfer_in / transfer_out)',
      'Per-merchant pickup origin configurable via API',
    ],
  },
  {
    Icon: Boxes,
    title: 'Stock movements',
    body:
      'Append-only ledger of every receipt, transfer, adjustment, and shipment. One source of truth across all warehouses.',
    details: [
      'Immutable movement history per SKU',
      'Receive, transfer, adjust, ship',
      'Reason codes + per-user attribution',
      'Drives the on-hand / reserved / available counters',
    ],
  },
  {
    Icon: ArrowLeftRight,
    title: 'Reservations',
    body:
      'Soft-hold inventory at checkout to prevent oversell. Released automatically on payment success or expiry — no manual reconciliation.',
    details: [
      'TTL-based soft holds (configurable)',
      'Auto-release on payment success / failure',
      'No oversell guarantee even at peak load',
      'Plays nice with Plugipay checkout events',
    ],
  },
  {
    Icon: Truck,
    title: 'Biteship shipping',
    body:
      'JNE, SiCepat, ID Express, J&T, Anteraja, Pos Indonesia, Lion Parcel, Ninja Xpress — Indonesian couriers in one API.',
    details: [
      'Rate cards across 8+ couriers via Biteship',
      'Pickup scheduling + waybill generation',
      'IDR-priced shipping fees billed to the merchant',
      'Per-warehouse default courier preferences',
    ],
  },
  {
    Icon: PackageCheck,
    title: 'Delivery tracking',
    body:
      'Real-time shipment events streamed back to your storefront for buyer-facing tracking. No more "where is my package?" tickets.',
    details: [
      'Webhook-driven event stream',
      'Buyer-facing tracking link per shipment',
      'Status timeline (picked → in transit → delivered)',
      'Email + WhatsApp notification hooks',
    ],
  },
  {
    Icon: ShieldCheck,
    title: 'License keys',
    body:
      'Digital fulfilment for software products. Mint on payment, track activations, revoke on refund — one service for physical + digital.',
    details: [
      'Issue license keys on payment.succeeded',
      'Per-license activation count + device tracking',
      'Revoke on refund (idempotent + auditable)',
      'API to verify license validity from your app',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
      {/* Hero — centered, matches pricing-page pattern */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Everything fulfilment, nothing else.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Six things Fulkruma ships. Multi-warehouse inventory, reservations,
          Biteship shipping, delivery tracking, and license keys — billed in
          Rupiah, plugged into your Storlaunch storefront in one click.
        </p>
      </div>

      {/* Feature grid */}
      <div className="mt-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {features.map(({ Icon, title, body, details }) => (
            <article
              key={title}
              className="rounded-xl border border-border bg-card p-6 md:p-8"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-6" strokeWidth={1.5} />
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.01em]">{title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {body}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {details.map((d) => (
                  <li key={d} className="flex items-start gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-20 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Try the free tier — no card required.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          50 fulfilled orders + 1 warehouse on the free plan. Upgrade only when
          you outgrow it.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-600"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-accent"
          >
            View pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
