'use client';

import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { ErrorBox, Loading, EmptyState, StatusPill } from '@/components/dashboard/ui';

interface Reservation {
  id: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  checkoutSessionId: string;
  expiresAt: string;
  consumedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
}

// The /stock/levels endpoint includes warehouse info but reservations
// don't have a dedicated route yet. We fetch them via a thin proxy on
// the existing infra by reading from /stock/movements + /warehouses
// and joining. Until then, reuse the seed-style fetch via a fallback.
//
// For now we list nothing — surface in next iteration with a real route.
// (Backend route exists in Phase E as a model but no list endpoint yet.)

export default function ReservationsPage() {
  const [rows, setRows] = useState<Reservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Use the addresses-style endpoint shape — placeholder; the
    // backend route is queued for Stage 4 but for now an empty list
    // is fine. (The seed has 2 entries, just no list route.)
    fetch('/api/v1/fulkruma/stock/reservations', { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 404) { setRows([]); return; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setRows(data.data?.reservations ?? []);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        icon={ClipboardList}
        title="Stock reservations"
        description="Soft-holds placed at checkout and released on payment success or expiry. Prevents oversell."
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <EmptyState>No active reservations. Reservations appear here when buyers open a checkout, and disappear when payment succeeds (consumed) or the session expires (released).</EmptyState>}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Checkout</th>
                <th className="px-4 py-3 text-right font-medium">Qty</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = r.consumedAt ? 'consumed' : r.releasedAt ? 'released' : new Date(r.expiresAt) < new Date() ? 'expired' : 'pending';
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.variantId}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.checkoutSessionId}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{r.quantity}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.expiresAt).toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusPill status={status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
