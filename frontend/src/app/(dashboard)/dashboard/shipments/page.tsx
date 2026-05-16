'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Truck } from 'lucide-react';
import { api, type Shipment, type ShipmentEvent } from '@/lib/api';
import { ErrorBox, StatusPill } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';

export default function ShipmentsPage() {
  const [rows, setRows] = useState<Shipment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try { setRows((await api<{ shipments: Shipment[] }>('/shipments?limit=100')).shipments); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  const columns: Column<Shipment>[] = [
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      sortValue: (s) => new Date(s.createdAt).getTime(),
      cell: (s) => (
        <span className="text-xs text-muted-foreground">
          {new Date(s.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'waybill',
      header: 'Waybill',
      sortable: true,
      sortValue: (s) => s.waybillId ?? '',
      searchValue: (s) => `${s.waybillId ?? ''} ${s.customerEmail ?? ''}`,
      cell: (s) => <span className="font-mono text-xs">{s.waybillId ?? '—'}</span>,
    },
    {
      key: 'courier',
      header: 'Courier',
      sortable: true,
      sortValue: (s) => `${s.courierCode} ${s.courierServiceCode}`,
      cell: (s) => (
        <span className="text-xs uppercase tracking-wider">
          <span className="font-medium">{s.courierCode}</span>{' '}
          <span className="text-muted-foreground">/ {s.courierServiceCode}</span>
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      sortValue: (s) => s.customerEmail ?? '',
      cell: (s) => (
        <span className="block truncate max-w-[180px] text-xs text-muted-foreground">
          {s.customerEmail ?? '—'}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.price,
      cell: (s) => (
        <span className="font-mono tabular-nums">Rp {s.price.toLocaleString('id-ID')}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (s) => s.status,
      cell: (s) => <StatusPill status={s.status} />,
    },
    {
      key: 'open',
      header: '',
      cell: () => <span className="text-xs text-muted-foreground">→</span>,
    },
  ];

  const filters: FilterDef<Shipment>[] = [
    { key: 'status', label: 'Status', accessor: (s) => s.status },
    { key: 'courier', label: 'Courier', accessor: (s) => s.courierCode },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Shipments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Outbound parcels, courier, tracking number, and event timeline. Backed by Biteship.
        </p>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {!rows && !error ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
          <Truck className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No shipments yet</p>
        </div>
      ) : rows && rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={columns}
          filters={filters}
          rowKey={(s) => s.id}
          searchPlaceholder="Search waybill, customer…"
          defaultSort={{ key: 'createdAt', dir: 'desc' }}
          empty="No shipments match."
          renderExpanded={(s) => <ShipmentDetailInline shipment={s} />}
        />
      ) : null}
    </div>
  );
}

function ShipmentDetailInline({ shipment }: { shipment: Shipment }) {
  const [full, setFull] = useState<Shipment & { events: ShipmentEvent[] } | null>(null);

  useEffect(() => {
    api<{ shipment: Shipment & { events: ShipmentEvent[] } }>(`/shipments/${shipment.id}`)
      .then((d) => setFull(d.shipment))
      .catch(() => {});
  }, [shipment.id]);

  const data = full ?? shipment;
  const dest = data.destinationSnapshot as { contactName?: string; address?: string; city?: string; postal?: string; contactPhone?: string };
  const origin = data.originSnapshot as { address?: string; city?: string; contactName?: string };
  const items = data.items as Array<{ name?: string; qty?: number; value?: number }>;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill status={data.status} />
        <span className="text-xs text-muted-foreground">
          {data.courierCode.toUpperCase()} · {data.courierServiceCode} · {data.courierType}
        </span>
        {data.trackingUrl && (
          <a href={data.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            Tracking <ExternalLink size={12} />
          </a>
        )}
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Box title="From">
          <p className="font-medium">{origin?.contactName ?? '—'}</p>
          <p className="text-muted-foreground">{origin?.address ?? '—'}</p>
          <p className="text-muted-foreground">{origin?.city ?? '—'}</p>
        </Box>
        <Box title="To">
          <p className="font-medium">{dest?.contactName ?? '—'}</p>
          <p className="text-muted-foreground">{dest?.address ?? '—'}</p>
          <p className="text-muted-foreground">{dest?.city ?? '—'} {dest?.postal ?? ''}</p>
          <p className="text-muted-foreground">{dest?.contactPhone ?? '—'}</p>
        </Box>
      </section>

      <Box title="Items">
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="py-2">{it.name ?? '—'}</td>
                  <td className="py-2 text-right font-mono text-xs text-muted-foreground">qty {it.qty ?? 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="space-y-2 md:hidden">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between rounded-md border border-border bg-card px-2 py-2">
              <span className="text-xs">{it.name ?? '—'}</span>
              <span className="font-mono text-xs text-muted-foreground">qty {it.qty ?? 1}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
          <span>Shipping cost</span>
          <span className="font-mono tabular-nums">Rp {data.price.toLocaleString('id-ID')}</span>
        </div>
      </Box>

      <Box title="Timeline">
        {!full && <p className="text-xs text-muted-foreground">Loading events…</p>}
        {full && full.events.length === 0 && <p className="text-xs text-muted-foreground">No events recorded yet.</p>}
        {full && full.events.length > 0 && (
          <ol className="space-y-3">
            {full.events.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusPill status={ev.status} />
                    <span className="text-xs text-muted-foreground">{new Date(ev.occurredAt).toLocaleString()}</span>
                  </div>
                  {ev.note && <p className="mt-0.5 text-xs text-muted-foreground">{ev.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Box>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
