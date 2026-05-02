'use client';

import { useEffect, useState } from 'react';
import { Boxes, Plus } from 'lucide-react';
import { api, type VariantStock, type Warehouse, type StockMovement } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Modal, Field, ErrorBox, Loading, EmptyState, Button } from '@/components/dashboard/ui';

const REASONS = [
  'manual_adjust',
  'initial_stock',
  'transfer_in',
  'transfer_out',
  'damaged',
  'returned_to_supplier',
  'refund_restock',
  'import',
] as const;

const LOW_THRESHOLD = 20;

export default function StockPage() {
  const [stock, setStock] = useState<VariantStock[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'levels' | 'movements'>('levels');

  async function reload() {
    try {
      const [s, w, m] = await Promise.all([
        api<{ stock: VariantStock[] }>('/stock/levels'),
        api<{ warehouses: Warehouse[] }>('/warehouses'),
        api<{ movements: StockMovement[] }>('/stock/movements'),
      ]);
      setStock(s.stock);
      setWarehouses(w.warehouses);
      setMovements(m.movements);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        icon={Boxes}
        title="Inventory"
        description="On-hand quantity per (variant × warehouse) and the audit trail of every movement."
        action={
          <Button onClick={() => setShowForm(true)} disabled={warehouses.length === 0}>
            <Plus size={14} /> Adjust stock
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {(['levels', 'movements'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'levels' ? 'Levels' : 'Movements'}
          </button>
        ))}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {tab === 'levels' && (
        <>
          {!stock && !error && <Loading />}
          {stock && stock.length === 0 && <EmptyState>No stock yet. Create a warehouse and adjust stock to start.</EmptyState>}
          {stock && stock.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">SKU</th>
                    <th className="px-4 py-3 text-left font-medium">Warehouse</th>
                    <th className="px-4 py-3 text-right font-medium">On-hand</th>
                    <th className="px-4 py-3 text-right font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs">{s.variantId}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.warehouse.name}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono tabular-nums">{s.quantity}</span>
                        {s.quantity > 0 && s.quantity < LOW_THRESHOLD && (
                          <span className="ml-2 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-700">
                            low
                          </span>
                        )}
                        {s.quantity === 0 && (
                          <span className="ml-2 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                            out
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{new Date(s.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'movements' && (
        <>
          {!movements && !error && <Loading />}
          {movements && movements.length === 0 && <EmptyState>No movements yet.</EmptyState>}
          {movements && movements.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">When</th>
                    <th className="px-4 py-3 text-left font-medium">SKU</th>
                    <th className="px-4 py-3 text-left font-medium">Warehouse</th>
                    <th className="px-4 py-3 text-left font-medium">Reason</th>
                    <th className="px-4 py-3 text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-xs">{m.variantId}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {warehouses.find((w) => w.id === m.warehouseId)?.name ?? m.warehouseId}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          {m.reason.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono tabular-nums ${m.delta < 0 ? 'text-destructive' : 'text-brand-700'}`}>
                        {m.delta > 0 ? '+' : ''}{m.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showForm && (
        <AdjustForm
          warehouses={warehouses}
          existingVariants={stock?.map((s) => s.variantId) ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload(); }}
        />
      )}
    </div>
  );
}

function AdjustForm({
  warehouses,
  existingVariants,
  onClose,
  onSaved,
}: {
  warehouses: Warehouse[];
  existingVariants: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [variantId, setVariantId] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [delta, setDelta] = useState<number>(0);
  const [reason, setReason] = useState<typeof REASONS[number]>('manual_adjust');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const variants = Array.from(new Set(existingVariants));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!variantId || !warehouseId || !delta) {
      setErr('variant, warehouse and a non-zero delta are required');
      return;
    }
    setSubmitting(true); setErr(null);
    try {
      await api('/stock/adjust', { method: 'POST', body: JSON.stringify({ variantId, warehouseId, delta, reason, note: note || undefined }) });
      onSaved();
    } catch (e) { setErr((e as Error).message); setSubmitting(false); }
  }

  return (
    <Modal title="Adjust stock" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Field label="Variant ID *" hint="Storlaunch ProductVariant id (string).">
          <input
            required
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            list="known-variants"
            className="input font-mono"
            placeholder="var_..."
          />
          <datalist id="known-variants">
            {variants.map((v) => <option key={v} value={v} />)}
          </datalist>
        </Field>
        <Field label="Warehouse *">
          <select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input">
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Delta *" hint="Positive = receive, negative = remove.">
            <input required type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="input" />
          </Field>
          <Field label="Reason *">
            <select required value={reason} onChange={(e) => setReason(e.target.value as typeof REASONS[number])} className="input">
              {REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} className="input" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting}>Apply adjustment</Button>
        </div>
      </form>
    </Modal>
  );
}
