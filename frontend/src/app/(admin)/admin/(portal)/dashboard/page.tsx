'use client';

import Link from 'next/link';
import { Building2, ArrowRight } from 'lucide-react';

// Admin dashboard — entry point to the Fulkruma staff console. The
// only admin-data surface today is Pattern-2 partner billing
// (`/api/v1/admin/partner/usage`), so the dashboard frames that: it
// lists the known partners and links into the usage viewer. New admin
// surfaces, when they ship, get their own card here.
//
// The known-partner list mirrors the backend `KNOWN_PARTNERS` enum in
// routes/admin.ts — Storlaunch + Ripllo consume Fulkruma as a module.

const KNOWN_PARTNERS = [
  { slug: 'storlaunch', name: 'Storlaunch', blurb: 'Storefront builder — Fulkruma module' },
  { slug: 'ripllo', name: 'Ripllo', blurb: 'Marketplace + referrals — Fulkruma module' },
];

export default function AdminDashboardHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Admin console</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review Pattern-2 partner-billing usage for the products that consume Fulkruma as a
        module.
      </p>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-muted-foreground">Partner usage</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {KNOWN_PARTNERS.map((p) => (
            <Link
              key={p.slug}
              href={`/admin/partners?partner=${p.slug}`}
              className="block rounded-xl border border-border bg-card p-5 transition hover:border-brand-500"
            >
              <Building2 size={18} />
              <p className="mt-3 text-sm font-semibold">{p.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{p.blurb}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                View usage <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
