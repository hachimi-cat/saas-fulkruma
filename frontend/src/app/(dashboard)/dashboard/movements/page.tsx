'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { api, type StockMovement, type Warehouse } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { ErrorBox, Loading, EmptyState } from '@/components/dashboard/ui';

export default function MovementsPage() {
  const [rows, setRows] = useState<StockMovement[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ movements: StockMovement[] }>('/stock/movements'),
      api<{ warehouses: Warehouse[] }>('/warehouses'),
    ])
      .then(([m, w]) => { setRows(m.movements); setWarehouses(w.warehouses); })
      .catch((e) => setError((e as Error).message));
  }, []);

  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id;

  return (
    <div className="">
      <PageHeader
        icon={ArrowLeftRight}
        title="Stock movements"
        description="Append-only ledger of every receipt, transfer, adjustment, and shipment-out. Source of truth for on-hand."
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <EmptyState>No movements yet.</EmptyState>}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">When</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Warehouse</th>
                <th className="px-4 py-3 text-left font-medium">Reason</th>
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.variantId}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{whName(m.warehouseId)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{m.reason.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.referenceId ?? '—'}</td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${m.delta < 0 ? 'text-destructive' : 'text-brand-700'}`}>
                    {m.delta > 0 ? '+' : ''}{m.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
