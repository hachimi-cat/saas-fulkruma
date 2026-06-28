'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Warehouse,
  Boxes,
  Truck,
  KeyRound,
  PackageCheck,
  ClipboardList,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { api, type OverviewStats } from '@/lib/api';
import { StatusPill } from '@/components/dashboard/ui';
import { PageHeader } from '@/components/dashboard/page-header';

export default function DashboardHome() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<OverviewStats>('/stats/overview')
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  const counters = stats?.counters;
  const tiles = [
    { label: 'Active warehouses', value: counters?.activeWarehouses, icon: Warehouse, href: '/dashboard/warehouses' },
    { label: 'SKUs tracked', value: counters?.skuCount, icon: Boxes, href: '/dashboard/stock' },
    { label: 'Shipments in transit', value: counters?.shipmentsInTransit, icon: Truck, href: '/dashboard/shipments' },
    { label: 'Active licenses', value: counters?.activeLicenses, icon: KeyRound, href: '/dashboard/licenses' },
    { label: 'Open reservations', value: counters?.openReservations, icon: ClipboardList, href: '/dashboard/shipments' },
    { label: 'Deliveries (30d)', value: counters?.deliveries30d, icon: PackageCheck, href: '/dashboard/deliveries' },
    { label: 'Pending shipments', value: counters?.pendingShipments, icon: Truck, href: '/dashboard/shipments?status=pending' },
    { label: 'Delivered (30d)', value: counters?.deliveredLast30d, icon: PackageCheck, href: '/dashboard/shipments?status=delivered' },
  ];

  return (
    <div className="">
      <PageHeader
        title="Overview"
        description="Stock, shipping, and fulfilment for your storefront."
      />

      {error && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load overview: {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-xl border border-border bg-card p-5 shadow-xs transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
              <Icon size={14} className="text-muted-foreground" strokeWidth={2} />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {value === undefined ? <Loader2 size={20} className="animate-spin text-muted-foreground" /> : value}
            </p>
          </Link>
        ))}
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Recent shipments" href="/dashboard/shipments">
          {!stats && <p className="text-sm text-muted-foreground">Loading…</p>}
          {stats && stats.recent.shipments.length === 0 && (
            <p className="text-sm text-muted-foreground">No shipments yet.</p>
          )}
          {stats && stats.recent.shipments.length > 0 && (
            <ul className="divide-y divide-border text-sm">
              {stats.recent.shipments.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-foreground">{s.waybillId ?? s.id.slice(-8)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.customerEmail ?? 'no email'} · {s.courierCode}
                    </p>
                  </div>
                  <StatusPill status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent movements" href="/dashboard/stock">
          {!stats && <p className="text-sm text-muted-foreground">Loading…</p>}
          {stats && stats.recent.movements.length === 0 && (
            <p className="text-sm text-muted-foreground">No movements yet.</p>
          )}
          {stats && stats.recent.movements.length > 0 && (
            <ul className="divide-y divide-border text-sm">
              {stats.recent.movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-foreground">{m.variantId}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.warehouse.name} · {m.reason}
                    </p>
                  </div>
                  <span className={`font-mono text-sm tabular-nums ${m.delta < 0 ? 'text-destructive' : 'text-brand-700'}`}>
                    {m.delta > 0 ? '+' : ''}{m.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function Card({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
          View all <ArrowRight size={12} />
        </Link>
      </header>
      {children}
    </div>
  );
}

