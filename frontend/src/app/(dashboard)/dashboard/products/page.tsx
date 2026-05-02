'use client';

import { useEffect, useState } from 'react';
import { Package, Plus, Archive, Layers, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Modal, Field, ErrorBox, Loading, EmptyState, Button } from '@/components/dashboard/ui';

interface Variant {
  id: string;
  productId: string;
  sku: string | null;
  name: string;
  priceCents: number;
  costCents: number | null;
  lowStockThreshold: number | null;
  weight: number | null;
  isDefault: boolean;
  archived: boolean;
  externalRef: string | null;
  externalSource: string | null;
}

interface Product {
  id: string;
  accountId: string;
  name: string;
  sku: string | null;
  description: string | null;
  type: 'physical' | 'digital' | 'license';
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  licenseEnabled: boolean;
  maxActivations: number;
  externalRef: string | null;
  externalSource: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  variants: Variant[];
}

type Envelope<T> = { data: T | null; error: { code: string; message: string } | null };

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('/') ? `/api/v1/fulkruma${path}` : `/api/v1/fulkruma/${path}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  const body = (await res.json()) as Envelope<T>;
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  return body.data as T;
}

export default function ProductsPage() {
  const [rows, setRows] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProduct, setShowProduct] = useState<Product | null | 'new'>(null);
  const [showVariants, setShowVariants] = useState<Product | null>(null);

  async function reload() {
    try { setRows((await api<{ products: Product[] }>('/products')).products); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function archive(p: Product) {
    if (!confirm(`Archive "${p.name}"? Stock + history kept.`)) return;
    try { await api(`/products/${p.id}`, { method: 'DELETE' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="">
      <PageHeader
        icon={Package}
        title="Products"
        description="Your product catalogue. When fulkruma runs as a Storlaunch module, products sync via webhook; standalone, manage them here directly."
        action={
          <Button onClick={() => setShowProduct('new')}>
            <Plus size={14} /> New product
          </Button>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <EmptyState>No products yet — create one to start tracking inventory.</EmptyState>}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Variants</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium">{p.name}</p>
                    {p.description && <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">{p.description}</p>}
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">{p.sku ?? '—'}</td>
                  <td className="px-4 py-3 align-top">
                    <span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">{p.type}</span>
                    {p.type === 'license' && p.licenseEnabled && (
                      <span className="ml-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                        license
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-right font-mono tabular-nums">{p.variants.length}</td>
                  <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                    {p.externalSource ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-mono">{p.externalSource}</span>
                        <ExternalLink size={10} />
                      </span>
                    ) : 'fulkruma'}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="inline-flex items-center gap-3">
                      <button onClick={() => setShowVariants(p)} className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline">
                        <Layers size={12} /> Variants
                      </button>
                      <button onClick={() => setShowProduct(p)} className="text-xs font-medium text-foreground hover:underline">Edit</button>
                      <button onClick={() => archive(p)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive">
                        <Archive size={12} /> Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showProduct === 'new' && (
        <ProductForm onClose={() => setShowProduct(null)} onSaved={() => { setShowProduct(null); reload(); }} />
      )}
      {showProduct && showProduct !== 'new' && (
        <ProductForm initial={showProduct} onClose={() => setShowProduct(null)} onSaved={() => { setShowProduct(null); reload(); }} />
      )}

      {showVariants && (
        <VariantsModal product={showVariants} onClose={() => setShowVariants(null)} onChanged={() => reload()} />
      )}
    </div>
  );
}

function ProductForm({ initial, onClose, onSaved }: { initial?: Product; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [sku, setSku] = useState(initial?.sku ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<Product['type']>(initial?.type ?? 'physical');
  const [weight, setWeight] = useState<number | ''>(initial?.weight ?? '');
  const [length, setLength] = useState<number | ''>(initial?.length ?? '');
  const [width, setWidth] = useState<number | ''>(initial?.width ?? '');
  const [height, setHeight] = useState<number | ''>(initial?.height ?? '');
  const [licenseEnabled, setLicenseEnabled] = useState(initial?.licenseEnabled ?? false);
  const [maxActivations, setMaxActivations] = useState<number>(initial?.maxActivations ?? 1);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setErr(null);
    const body: Record<string, unknown> = {
      name, type, licenseEnabled, maxActivations,
      sku: sku || undefined,
      description: description || undefined,
    };
    if (type === 'physical') {
      if (weight !== '') body.weight = Number(weight);
      if (length !== '') body.length = Number(length);
      if (width !== '') body.width = Number(width);
      if (height !== '') body.height = Number(height);
    }
    try {
      if (initial) await api(`/products/${initial.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/products', { method: 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (e) { setErr((e as Error).message); setSubmitting(false); }
  }

  return (
    <Modal title={initial ? 'Edit product' : 'New product'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name *"><input required value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
          <Field label="SKU"><input value={sku} onChange={(e) => setSku(e.target.value)} className="input font-mono" /></Field>
        </div>
        <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} /></Field>
        <Field label="Type *">
          <select value={type} onChange={(e) => setType(e.target.value as Product['type'])} className="input">
            <option value="physical">Physical (ships)</option>
            <option value="digital">Digital (downloadable)</option>
            <option value="license">License key</option>
          </select>
        </Field>
        {type === 'physical' && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Shipping dimensions (used for Biteship rate calc)</p>
            <div className="grid grid-cols-4 gap-2">
              <Field label="g"><input type="number" value={weight} onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))} className="input" /></Field>
              <Field label="L cm"><input type="number" value={length} onChange={(e) => setLength(e.target.value === '' ? '' : Number(e.target.value))} className="input" /></Field>
              <Field label="W cm"><input type="number" value={width} onChange={(e) => setWidth(e.target.value === '' ? '' : Number(e.target.value))} className="input" /></Field>
              <Field label="H cm"><input type="number" value={height} onChange={(e) => setHeight(e.target.value === '' ? '' : Number(e.target.value))} className="input" /></Field>
            </div>
          </div>
        )}
        {type === 'license' && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={licenseEnabled} onChange={(e) => setLicenseEnabled(e.target.checked)} />
              <span>Auto-issue license keys on payment</span>
            </label>
            <Field label="Max activations per key"><input type="number" min={1} value={maxActivations} onChange={(e) => setMaxActivations(Number(e.target.value))} className="input" /></Field>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function VariantsModal({ product, onClose, onChanged }: { product: Product; onClose: () => void; onChanged: () => void }) {
  const [variants, setVariants] = useState<Variant[]>(product.variants);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Variant | null>(null);

  async function reloadFull() {
    const fresh = await api<{ product: Product }>(`/products/${product.id}`);
    setVariants(fresh.product.variants);
    onChanged();
  }

  async function archive(v: Variant) {
    if (v.isDefault) { alert('Cannot archive the default variant. Set another variant as default first.'); return; }
    if (!confirm(`Archive variant "${v.name}"?`)) return;
    try { await api(`/products/${product.id}/variants/${v.id}`, { method: 'DELETE' }); reloadFull(); }
    catch (e) { alert((e as Error).message); }
  }

  return (
    <Modal title={`Variants — ${product.name}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button onClick={() => setShowAdd(true)}><Plus size={14} /> New variant</Button>
        </div>
        {variants.length === 0 ? (
          <EmptyState>No variants. Add one to start tracking stock.</EmptyState>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">SKU</th>
                  <th className="px-3 py-2 text-right font-medium">Price (cents)</th>
                  <th className="px-3 py-2 text-right font-medium">Low @</th>
                  <th className="px-3 py-2 text-right font-medium">Default</th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {variants.filter((v) => !v.archived).map((v) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{v.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{v.sku ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{v.priceCents}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{v.lowStockThreshold ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {v.isDefault && (
                        <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                          default
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => setEditing(v)} className="text-xs font-medium hover:underline">Edit</button>
                        <button onClick={() => archive(v)} className="text-xs text-muted-foreground hover:text-destructive">Archive</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showAdd && (
        <VariantForm
          productId={product.id}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); reloadFull(); }}
        />
      )}
      {editing && (
        <VariantForm
          productId={product.id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reloadFull(); }}
        />
      )}
    </Modal>
  );
}

function VariantForm({ productId, initial, onClose, onSaved }: { productId: string; initial?: Variant; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [sku, setSku] = useState(initial?.sku ?? '');
  const [priceCents, setPriceCents] = useState<number>(initial?.priceCents ?? 0);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | ''>(initial?.lowStockThreshold ?? '');
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setErr(null);
    const body: Record<string, unknown> = { name, priceCents, isDefault };
    if (sku) body.sku = sku;
    if (lowStockThreshold !== '') body.lowStockThreshold = Number(lowStockThreshold);
    try {
      if (initial) await api(`/products/${productId}/variants/${initial.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api(`/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (e) { setErr((e as Error).message); setSubmitting(false); }
  }

  return (
    <Modal title={initial ? 'Edit variant' : 'New variant'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Field label="Name *" hint="e.g. 'Black / M', 'Red / OneSize'.">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="SKU"><input value={sku} onChange={(e) => setSku(e.target.value)} className="input font-mono" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (cents)" hint="Informational; payment runs in Plugipay.">
            <input type="number" min={0} value={priceCents} onChange={(e) => setPriceCents(Number(e.target.value))} className="input" />
          </Field>
          <Field label="Low-stock threshold" hint="Empty = disabled.">
            <input type="number" min={0} value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value === '' ? '' : Number(e.target.value))} className="input" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          <span>Default variant for this product</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
