import Link from 'next/link';
import { Truck, Boxes, Warehouse, ArrowRight } from 'lucide-react';

const features = [
  { icon: Warehouse, title: 'Multi-warehouse', body: 'Track stock across many physical or virtual locations.' },
  { icon: Boxes, title: 'Reservations', body: 'Soft-hold inventory at checkout to prevent oversell.' },
  { icon: Truck, title: 'Biteship shipping', body: 'Indonesian courier integration out of the box.' },
];

export default function MarketingLanding() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-700">
        Forjio family · M5
      </span>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
        Stock and shipping that <span className="text-brand-500">just works</span>{' '}
        for Indonesian storefronts.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
        Multi-warehouse inventory, reservations, and Biteship-powered shipping —
        billed in IDR, plugged into your Storlaunch storefront in one click.
      </p>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-brand-600 transition"
        >
          Open dashboard <ArrowRight size={14} />
        </Link>
        <a
          href="#features"
          className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition"
        >
          See features
        </a>
      </div>

      <section id="features" className="mt-20 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-5 text-left">
            <Icon size={18} className="text-brand-500" strokeWidth={2} />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <p className="mt-20 text-xs text-muted-foreground">
        Phase B scaffold — full landing arrives in Phase D.
      </p>
    </main>
  );
}
