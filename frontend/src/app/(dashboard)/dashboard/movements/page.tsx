'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { api, type StockMovement, type Warehouse } from '@/lib/api';
import { ErrorBox } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';
import { PageHeader } from '@/components/dashboard/page-header';

export default function MovementsPage() {
  const [rows, setRows] = useState<StockMovement[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ movements: StockMovement[] }>('/stock/movements?limit=100'),
      api<{ warehouses: Warehouse[] }>('/warehouses?limit=100'),
    ])
      .then(([m, w]) => { setRows(m.movements); setWarehouses(w.warehouses); })
      .catch((e) => setError((e as Error).message));
  }, []);

  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id;

  const columns: Column<StockMovement>[] = [
    {
      key: 'when',
      header: 'When',
      sortable: true,
      sortValue: (m) => new Date(m.createdAt).getTime(),
      cell: (m) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(m.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      sortValue: (m) => m.variantId,
      searchValue: (m) => `${m.variantId} ${whName(m.warehouseId)} ${m.reason} ${m.referenceId ?? ''}`,
      cell: (m) => <span className="font-mono text-xs">{m.variantId}</span>,
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      sortable: true,
      sortValue: (m) => whName(m.warehouseId),
      cell: (m) => <span className="text-xs text-muted-foreground">{whName(m.warehouseId)}</span>,
    },
    {
      key: 'reason',
      header: 'Reason',
      sortable: true,
      sortValue: (m) => m.reason,
      cell: (m) => (
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {m.reason.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      cell: (m) => <span className="font-mono text-xs text-muted-foreground">{m.referenceId ?? '—'}</span>,
    },
    {
      key: 'delta',
      header: 'Δ',
      align: 'right',
      sortable: true,
      sortValue: (m) => m.delta,
      cell: (m) => (
        <span className={`font-mono tabular-nums ${m.delta < 0 ? 'text-destructive' : 'text-brand-700'}`}>
          {m.delta > 0 ? '+' : ''}{m.delta}
        </span>
      ),
    },
  ];

  const filters: FilterDef<StockMovement>[] = [
    { key: 'reason', label: 'Reason', accessor: (m) => m.reason },
    {
      key: 'warehouse',
      label: 'Warehouse',
      accessor: (m) => m.warehouseId,
      options: warehouses.map((w) => ({ value: w.id, label: w.name })),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Stock movements"
        description="Append-only ledger of every receipt, transfer, adjustment, and shipment-out. Source of truth for on-hand."
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      {!rows && !error ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
          <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No movements yet</p>
        </div>
      ) : rows && rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={columns}
          filters={filters}
          rowKey={(m) => m.id}
          searchPlaceholder="Search SKU, warehouse, reason…"
          defaultSort={{ key: 'when', dir: 'desc' }}
          empty="No movements match."
        />
      ) : null}
    </div>
  );
}
