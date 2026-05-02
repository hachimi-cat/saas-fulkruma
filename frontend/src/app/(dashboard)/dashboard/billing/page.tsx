'use client';

import { Wallet, ExternalLink, Check } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';

const TIERS = [
  { name: 'Free', price: 'Rp 0', sub: 'up to 50 orders/mo', features: ['1 warehouse', '50 fulfilled orders', 'Biteship couriers', 'Email support'] },
  { name: 'Starter', price: 'Rp 299k', sub: 'per month', features: ['3 warehouses', '500 orders/mo', 'Reservations + low-stock alerts', 'License keys'], popular: true },
  { name: 'Growth', price: 'Rp 799k', sub: 'per month', features: ['10 warehouses', '5,000 orders/mo', 'Multi-region routing', 'Priority support'] },
  { name: 'Scale', price: 'Rp 1.999k', sub: 'per month', features: ['Unlimited warehouses', '50,000 orders/mo', 'Custom courier rates', 'SLA'] },
];

export default function BillingPage() {
  // Bang's account is the platform-owner; billing is N/A in dev.
  // Real Plugipay-driven plan + invoice list lands in Phase F when the
  // Plugipay platform-admin key is minted. Surface the source-of-truth
  // pointer + the locked pricing tiers so the page is informative.
  return (
    <div className="">
      <PageHeader
        icon={Wallet}
        title="Billing"
        description="Plan + invoices. Fulkruma billing is reconciled monthly via Plugipay (Pattern 2 partner billing)."
      />

      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</p>
            <p className="mt-1 text-2xl font-semibold">Free</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You&rsquo;re on the dev tier. Upgrade once you ship to a real merchant.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Provider</p>
            <p className="mt-1 font-mono">plugipay.com</p>
          </div>
        </div>
      </section>

      <h2 className="mb-3 text-sm font-semibold tracking-tight">Plans</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={`relative rounded-xl border bg-card p-5 ${t.popular ? 'border-brand-500 shadow-md' : 'border-border'}`}
          >
            {t.popular && (
              <span className="absolute -top-2.5 left-5 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                Most popular
              </span>
            )}
            <p className="text-sm font-semibold">{t.name}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{t.price}</p>
            <p className="text-xs text-muted-foreground">{t.sub}</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-brand-500" /><span>{f}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">Invoices</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Past invoices are visible in your Plugipay dashboard. Fulkruma rolls into a unified Plugipay
          invoice each month via the Pattern 2 partner-billing flow.
        </p>
        <Link
          href="https://plugipay.com/dashboard/invoices"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium hover:bg-secondary"
        >
          Open Plugipay invoices <ExternalLink size={14} />
        </Link>
      </section>
    </div>
  );
}
