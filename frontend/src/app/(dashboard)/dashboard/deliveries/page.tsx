'use client';

import { useEffect, useState } from 'react';
import { PackageCheck, Plus } from 'lucide-react';
import { api, type Delivery } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Modal, Field, ErrorBox, Loading, EmptyState, Button } from '@/components/dashboard/ui';

interface ProductLite { id: string; name: string; type: string; }

export default function DeliveriesPage() {
  const [rows, setRows] = useState<Delivery[] | null>(null);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    try {
      const [d, p] = await Promise.all([
        api<{ deliveries: Delivery[] }>('/deliveries'),
        api<{ products: ProductLite[] }>('/products'),
      ]);
      setRows(d.deliveries);
      setProducts(p.products.filter((x) => x.type === 'digital'));
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  return (
    <div className="">
      <PageHeader
        icon={PackageCheck}
        title="Digital Deliveries"
        description="Per-order download tracking. Buyers get a unique download URL after Plugipay confirms payment."
        action={<Button onClick={() => setShowForm(true)}><Plus size={14} /> New delivery</Button>}
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <EmptyState>No deliveries yet.</EmptyState>}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Checkout</th>
                <th className="px-4 py-3 text-right font-medium">Downloads</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const expired = new Date(d.expiresAt) < new Date();
                const exhausted = d.downloadCount >= d.maxDownloads;
                const productName = products.find((p) => p.id === d.productId)?.name ?? d.productId;
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium">{productName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{d.productId}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.customerId}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.checkoutSessionId}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono tabular-nums ${exhausted ? 'text-destructive' : ''}`}>
                        {d.downloadCount} / {d.maxDownloads}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={expired ? 'text-destructive' : 'text-muted-foreground'}>
                        {new Date(d.expiresAt).toLocaleDateString()}
                        {expired && ' · expired'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
