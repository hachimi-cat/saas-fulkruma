'use client';

import { useEffect, useState } from 'react';
import { Truck, ExternalLink } from 'lucide-react';
import { api, type Shipment, type ShipmentEvent } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Modal, ErrorBox, Loading, EmptyState, StatusPill } from '@/components/dashboard/ui';

export default function ShipmentsPage() {
  const [rows, setRows] = useState<Shipment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Shipment | null>(null);

  async function reload() {
    try { setRows((await api<{ shipments: Shipment[] }>('/shipments')).shipments); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  return (
    <div className="">
      <PageHeader
        icon={Truck}
        title="Shipments"
        description="Outbound parcels, courier, tracking number, and event timeline. Backed by Biteship."
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <EmptyState>No shipments yet.</EmptyState>}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Waybill</th>
                <th className="px-4 py-3 text-left font-medium">Courier</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-secondary/50 cursor-pointer" onClick={() => setActive(s)}>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.waybillId ?? '—'}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wider">
                    <span className="font-medium">{s.courierCode}</span>{' '}
                    <span className="text-muted-foreground">/ {s.courierServiceCode}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[180px]">{s.customerEmail ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">Rp {s.price.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active && (
        <ShipmentDetail shipment={active} onClose={() => setActive(null)} />
      )}
    </div>
  );
}

function ShipmentDetail({ shipment, onClose }: { shipment: Shipment; onClose: () => void }) {
  const [full, setFull] = useState<Shipment & { events: ShipmentEvent[] } | null>(null);

  useEffect(() => {
    api<{ shipment: Shipment & { events: ShipmentEvent[] } }>(`/shipments/${shipment.id}`)
      .then((d) => setFull(d.shipment))
      .catch(() => {/* fall through with whatever we have */});
  }, [shipment.id]);

  const data = full ?? shipment;
  const dest = data.destinationSnapshot as { contactName?: string; address?: string; city?: string; postal?: string; contactPhone?: string };
  const origin = data.originSnapshot as { address?: string; city?: string; contactName?: string };
  const items = data.items as Array<{ name?: string; qty?: number; value?: number }>;

  return (
    <Modal title={`Shipment ${data.waybillId ?? data.id.slice(-8)}`} onClose={onClose} wide>
      <div className="space-y-5 text-sm">
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
          <ul className="divide-y divide-border">
            {items.map((it, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>{it.name ?? '—'}</span>
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
    </Modal>
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
