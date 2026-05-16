'use client';

import { useEffect, useState } from 'react';
import { Boxes, Loader2, Plus } from 'lucide-react';
import { api, type VariantStock, type Warehouse, type StockMovement } from '@/lib/api';
import { Modal, Field, ErrorBox, Button } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';

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
        api<{ stock: VariantStock[] }>('/stock/levels?limit=100'),
        api<{ warehouses: Warehouse[] }>('/warehouses?limit=100'),
        api<{ movements: StockMovement[] }>('/stock/movements?limit=100'),
      ]);
      setStock(s.stock);
      setWarehouses(w.warehouses);
      setMovements(m.movements);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id;

  const levelColumns: Column<VariantStock>[] = [
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      sortValue: (s) => s.variantId,
      searchValue: (s) => `${s.variantId} ${s.warehouse.name}`,
      cell: (s) => <span className="font-mono text-xs">{s.variantId}</span>,
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      sortable: true,
      sortValue: (s) => s.warehouse.name,
      cell: (s) => <span className="text-muted-foreground">{s.warehouse.name}</span>,
    },
    {
      key: 'onhand',
      header: 'On-hand',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.quantity,
      cell: (s) => (
        <span>
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
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      align: 'right',
      sortable: true,
      sortValue: (s) => new Date(s.updatedAt).getTime(),
      cell: (s) => <span className="text-xs text-muted-foreground">{new Date(s.updatedAt).toLocaleString()}</span>,
    },
  ];

  const levelFilters: FilterDef<VariantStock>[] = [
    {
      key: 'warehouse',
      label: 'Warehouse',
      accessor: (s) => s.warehouseId,
      options: warehouses.map((w) => ({ value: w.id, label: w.name })),
    },
    {
      key: 'level',
      label: 'Level',
      accessor: (s) => (s.quantity === 0 ? 'out' : s.quantity < LOW_THRESHOLD ? 'low' : 'ok'),
      options: [
        { value: 'ok', label: 'OK' },
        { value: 'low', label: 'Low' },
        { value: 'out', label: 'Out' },
      ],
    },
  ];

  const movementColumns: Column<StockMovement>[] = [
    {
      key: 'when',
      header: 'When',
      sortable: true,
      sortValue: (m) => new Date(m.createdAt).getTime(),
      cell: (m) => <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>,
    },
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      sortValue: (m) => m.variantId,
      searchValue: (m) => `${m.variantId} ${whName(m.warehouseId)} ${m.reason}`,
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

  const movementFilters: FilterDef<StockMovement>[] = [
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            On-hand quantity per (variant × warehouse) and the audit trail of every movement.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} disabled={warehouses.length === 0}>
          <Plus size={14} /> Adjust stock
        </Button>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
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
        !stock && !error ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : stock && stock.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
            <Boxes className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No stock yet</p>
          </div>
        ) : stock && stock.length > 0 ? (
          <DataTable
            rows={stock}
            columns={levelColumns}
            filters={levelFilters}
            rowKey={(s) => s.id}
            searchPlaceholder="Search SKU, warehouse…"
            defaultSort={{ key: 'updated', dir: 'desc' }}
            empty="No stock matches."
          />
        ) : null
      )}

      {tab === 'movements' && (
        !movements && !error ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : movements && movements.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
            <Boxes className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No movements yet</p>
          </div>
        ) : movements && movements.length > 0 ? (
          <DataTable
            rows={movements}
            columns={movementColumns}
            filters={movementFilters}
            rowKey={(m) => m.id}
            searchPlaceholder="Search SKU, warehouse, reason…"
            defaultSort={{ key: 'when', dir: 'desc' }}
            empty="No movements match."
          />
        ) : null
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
