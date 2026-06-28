'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import { ErrorBox, StatusPill } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';
import { PageHeader } from '@/components/dashboard/page-header';

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

function statusOf(r: Reservation): string {
  if (r.consumedAt) return 'consumed';
  if (r.releasedAt) return 'released';
  if (new Date(r.expiresAt) < new Date()) return 'expired';
  return 'pending';
}

export default function ReservationsPage() {
  const [rows, setRows] = useState<Reservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/fulkruma/stock/reservations?limit=100', { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 404) { setRows([]); return; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setRows(data.data?.reservations ?? []);
      })
      .catch((e) => setError(e.message));
  }, []);

  const columns: Column<Reservation>[] = [
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      sortValue: (r) => new Date(r.createdAt).getTime(),
      cell: (r) => <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>,
    },
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      sortValue: (r) => r.variantId,
      searchValue: (r) => `${r.variantId} ${r.checkoutSessionId}`,
      cell: (r) => <span className="font-mono text-xs">{r.variantId}</span>,
    },
    {
      key: 'checkout',
      header: 'Checkout',
      cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.checkoutSessionId}</span>,
    },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.quantity,
      cell: (r) => <span className="font-mono tabular-nums">{r.quantity}</span>,
    },
    {
      key: 'expires',
      header: 'Expires',
      sortable: true,
      sortValue: (r) => new Date(r.expiresAt).getTime(),
      cell: (r) => <span className="text-xs text-muted-foreground">{new Date(r.expiresAt).toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => statusOf(r),
      cell: (r) => <StatusPill status={statusOf(r)} />,
    },
  ];

  const filters: FilterDef<Reservation>[] = [
    {
      key: 'status',
      label: 'Status',
      accessor: (r) => statusOf(r),
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'consumed', label: 'Consumed' },
        { value: 'released', label: 'Released' },
        { value: 'expired', label: 'Expired' },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Stock reservations"
        description="Soft-holds placed at checkout and released on payment success or expiry. Prevents oversell."
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      {!rows && !error ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 text-center">
          <ClipboardList className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No active reservations</p>
        </div>
      ) : rows && rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={columns}
          filters={filters}
          rowKey={(r) => r.id}
          searchPlaceholder="Search SKU, checkout…"
          defaultSort={{ key: 'createdAt', dir: 'desc' }}
          empty="No reservations match."
        />
      ) : null}
    </div>
  );
}
