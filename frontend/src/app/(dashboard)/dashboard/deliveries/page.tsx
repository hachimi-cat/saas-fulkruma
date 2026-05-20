'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2, PackageCheck, Plus } from 'lucide-react';
import { api, type Delivery } from '@/lib/api';
import { Modal, Field, ErrorBox, Button } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';

interface ProductLite { id: string; name: string; type: string; }

function deliveryStatus(d: Delivery): string {
  if (new Date(d.expiresAt) < new Date()) return 'expired';
  if (d.downloadCount >= d.maxDownloads) return 'exhausted';
  return 'active';
}

export default function DeliveriesPage() {
  const [rows, setRows] = useState<Delivery[] | null>(null);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    try {
      const [d, p] = await Promise.all([
        api<{ deliveries: Delivery[] }>('/deliveries?limit=100'),
        api<{ products: ProductLite[] }>('/products?limit=100'),
      ]);
      setRows(d.deliveries);
      setProducts(p.products.filter((x) => x.type === 'digital'));
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  const columns: Column<Delivery>[] = [
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      sortValue: (d) => new Date(d.createdAt).getTime(),
      cell: (d) => <span className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: 'product',
      header: 'Product',
      sortable: true,
      sortValue: (d) => productName(d.productId),
      searchValue: (d) => `${productName(d.productId)} ${d.productId} ${d.customerId} ${d.checkoutSessionId}`,
      cell: (d) => (
        <div className="text-xs">
          <Link href="/dashboard/products" className="font-medium text-primary hover:underline">
            {productName(d.productId)}
          </Link>
          <p className="font-mono text-[10px] text-muted-foreground">{d.productId}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      sortValue: (d) => d.customerId,
      cell: (d) => <span className="font-mono text-xs text-muted-foreground">{d.customerId}</span>,
    },
    {
      key: 'checkout',
      header: 'Checkout',
      cell: (d) => <span className="font-mono text-xs text-muted-foreground">{d.checkoutSessionId}</span>,
    },
    {
      key: 'downloads',
      header: 'Downloads',
      align: 'right',
      sortable: true,
      sortValue: (d) => d.downloadCount,
      cell: (d) => {
        const exhausted = d.downloadCount >= d.maxDownloads;
        return (
          <span className={`font-mono tabular-nums ${exhausted ? 'text-destructive' : ''}`}>
            {d.downloadCount} / {d.maxDownloads}
          </span>
        );
      },
    },
    {
      key: 'expires',
      header: 'Expires',
      sortable: true,
      sortValue: (d) => new Date(d.expiresAt).getTime(),
      cell: (d) => {
        const expired = new Date(d.expiresAt) < new Date();
        return (
          <span className={`text-xs ${expired ? 'text-destructive' : 'text-muted-foreground'}`}>
            {new Date(d.expiresAt).toLocaleDateString()}
            {expired && ' · expired'}
          </span>
        );
      },
    },
  ];

  const filters: FilterDef<Delivery>[] = [
    {
      key: 'status',
      label: 'Status',
      accessor: (d) => deliveryStatus(d),
      options: [
        { value: 'active', label: 'Active' },
        { value: 'exhausted', label: 'Exhausted' },
        { value: 'expired', label: 'Expired' },
      ],
    },
    {
      key: 'product',
      label: 'Product',
      accessor: (d) => d.productId,
      options: products.map((p) => ({ value: p.id, label: p.name })),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Digital Deliveries</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-order download tracking. Buyers get a unique download URL after Plugipay confirms payment.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={14} /> New delivery</Button>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {!rows && !error ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
          <PackageCheck className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No deliveries yet</p>
        </div>
      ) : rows && rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={columns}
          filters={filters}
          rowKey={(d) => d.id}
          searchPlaceholder="Search product, customer, checkout…"
          defaultSort={{ key: 'createdAt', dir: 'desc' }}
          empty="No deliveries match."
        />
      ) : null}

      {showForm && (
        <CreateForm
          products={products}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload(); }}
        />
      )}
    </div>
  );
}

function CreateForm({ products, onClose, onSaved }: { products: ProductLite[]; onClose: () => void; onSaved: () => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [customerId, setCustomerId] = useState('');
  const [checkoutSessionId, setCheckoutSessionId] = useState('');
  const [maxDownloads, setMaxDownloads] = useState<number>(5);
  const [expiresInDays, setExpiresInDays] = useState<number>(14);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) { setErr('Pick a digital product first.'); return; }
    setSubmitting(true); setErr(null);
    try {
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000).toISOString();
      await api('/deliveries', { method: 'POST', body: JSON.stringify({ productId, customerId, checkoutSessionId, maxDownloads, expiresAt }) });
      onSaved();
    } catch (e) { setErr((e as Error).message); setSubmitting(false); }
  }

  return (
    <Modal title="New digital delivery" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        {products.length === 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            No digital products in your catalogue. Create one in <a href="/dashboard/products" className="font-medium underline">Products</a> first (set type = digital).
          </div>
        )}
        <Field label="Product *">
          <select required value={productId} onChange={(e) => setProductId(e.target.value)} className="input" disabled={products.length === 0}>
            {products.length === 0 ? <option>— no digital products —</option> : products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Customer ID *" hint="Buyer id (Storlaunch Customer or Huudis user).">
          <input required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input font-mono" placeholder="cust_..." />
        </Field>
        <Field label="Checkout session ID *" hint="Plugipay or Storlaunch checkoutSessionId. Unique per delivery.">
          <input required value={checkoutSessionId} onChange={(e) => setCheckoutSessionId(e.target.value)} className="input font-mono" placeholder="cs_..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max downloads"><input type="number" min={1} max={100} value={maxDownloads} onChange={(e) => setMaxDownloads(Number(e.target.value))} className="input" /></Field>
          <Field label="Expires in (days)"><input type="number" min={1} max={365} value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))} className="input" /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={products.length === 0}>Create delivery</Button>
        </div>
      </form>
    </Modal>
  );
}
