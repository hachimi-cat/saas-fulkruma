'use client';

import { useEffect, useState } from 'react';
import { Plus, Copy, Check, Loader2, KeyRound } from 'lucide-react';
import { api, type License } from '@/lib/api';
import { Modal, Field, ErrorBox, Button, StatusPill } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';

interface ProductLite { id: string; name: string; type: string; licenseEnabled: boolean; maxActivations: number; }

export default function LicensesPage() {
  const [rows, setRows] = useState<License[] | null>(null);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [issued, setIssued] = useState<License | null>(null);
  const [copied, setCopied] = useState(false);
  const [devicesFor, setDevicesFor] = useState<License | null>(null);

  async function reload() {
    try {
      const [l, p] = await Promise.all([
        api<{ licenses: License[] }>('/licenses?limit=100'),
        api<{ products: ProductLite[] }>('/products?limit=100'),
      ]);
      setRows(l.licenses);
      setProducts(p.products.filter((x) => x.type === 'license'));
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function revoke(l: License) {
    if (!confirm(`Revoke license ${l.key}? Buyers' apps will fail activation.`)) return;
    try { await api(`/licenses/${l.id}/revoke`, { method: 'POST' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  const columns: Column<License>[] = [
    {
      key: 'key',
      header: 'Key',
      sortable: true,
      sortValue: (l) => l.key,
      searchValue: (l) => `${l.key} ${productName(l.productId)} ${l.customerId}`,
      cell: (l) => <code className="font-mono text-xs">{l.key}</code>,
    },
    {
      key: 'product',
      header: 'Product',
      sortable: true,
      sortValue: (l) => productName(l.productId),
      cell: (l) => <span className="font-mono text-xs text-muted-foreground">{l.productId}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      sortValue: (l) => l.customerId,
      cell: (l) => <span className="font-mono text-xs text-muted-foreground">{l.customerId}</span>,
    },
    {
      key: 'activations',
      header: 'Activations',
      align: 'right',
      sortable: true,
      sortValue: (l) => l.activations,
      cell: (l) => (
        <button
          type="button"
          onClick={() => setDevicesFor(l)}
          className="font-mono tabular-nums underline decoration-dotted underline-offset-2 hover:text-foreground"
          title="View activated devices"
        >
          {l.activations}/{l.maxActivations}
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (l) => l.status,
      cell: (l) => <StatusPill status={l.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (l) =>
        l.status === 'active' ? (
          <button onClick={() => revoke(l)} className="text-xs font-medium text-muted-foreground hover:text-destructive">
            Revoke
          </button>
        ) : null,
    },
  ];

  const filters: FilterDef<License>[] = [
    {
      key: 'status',
      label: 'Status',
      accessor: (l) => l.status,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'revoked', label: 'Revoked' },
      ],
    },
    {
      key: 'product',
      label: 'Product',
      accessor: (l) => l.productId,
      options: products.map((p) => ({ value: p.id, label: p.name })),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Licenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Digital fulfilment — license keys minted on payment, activations tracked, revocation supported.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={14} /> Issue license</Button>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {!rows && !error ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
          <KeyRound className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No licenses yet</p>
        </div>
      ) : rows && rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={columns}
          filters={filters}
          rowKey={(l) => l.id}
          searchPlaceholder="Search key, product, customer…"
          defaultSort={{ key: 'key', dir: 'asc' }}
          empty="No licenses match."
        />
      ) : null}

      {showForm && (
        <IssueForm
          products={products}
          onClose={() => setShowForm(false)}
          onSaved={(l) => { setShowForm(false); setIssued(l); reload(); }}
        />
      )}

      {issued && (
        <Modal title="License issued" onClose={() => { setIssued(null); setCopied(false); }}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send this key to the buyer. Lookup is via the key string — store it safely on their side.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
              <code className="flex-1 font-mono text-sm">{issued.key}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(issued.key); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-secondary"
              >
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Up to <span className="font-mono">{issued.maxActivations}</span> activation
              {issued.maxActivations === 1 ? '' : 's'}.
            </p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setIssued(null)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}

      {devicesFor && (
        <DeviceModal license={devicesFor} onClose={() => setDevicesFor(null)} onChanged={reload} />
      )}
    </div>
  );
}

function IssueForm({ products, onClose, onSaved }: { products: ProductLite[]; onClose: () => void; onSaved: (l: License) => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [customerId, setCustomerId] = useState('');
  const [maxActivations, setMaxActivations] = useState<number>(products[0]?.maxActivations ?? 1);
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = products.find((x) => x.id === productId);
    if (p) setMaxActivations(p.maxActivations);
  }, [productId, products]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) { setErr('Pick a license-enabled product first.'); return; }
    setSubmitting(true); setErr(null);
    try {
      const body: Record<string, unknown> = { productId, customerId, maxActivations };
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      const data = await api<{ license: License }>('/licenses', { method: 'POST', body: JSON.stringify(body) });
      onSaved(data.license);
    } catch (e) { setErr((e as Error).message); setSubmitting(false); }
  }

  return (
    <Modal title="Issue license" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        {products.length === 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            No license-type products in your catalogue. Create one in <a href="/dashboard/products" className="font-medium underline">Products</a> first (set type = license).
          </div>
        )}
        <Field label="Product *">
          <select required value={productId} onChange={(e) => setProductId(e.target.value)} className="input" disabled={products.length === 0}>
            {products.length === 0
              ? <option>— no license products —</option>
              : products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Customer ID *" hint="Buyer id (Storlaunch Customer or Huudis user).">
          <input required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input font-mono" placeholder="cust_..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max activations *">
            <input required type="number" min={1} value={maxActivations} onChange={(e) => setMaxActivations(Number(e.target.value))} className="input" />
          </Field>
          <Field label="Expires at">
            <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="input" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={products.length === 0}>Issue</Button>
        </div>
      </form>
    </Modal>
  );
}

interface ActivationRow {
  id: string;
  instanceId: string;
  activatedAt: string;
  deactivatedAt: string | null;
}

// Per-device activation manager — the depth the licenses table can't
// show. Reads GET /licenses/lookup (F-010) for the LicenseActivation
// rows; lets the merchant free a seat by deactivating a device.
function DeviceModal({
  license,
  onClose,
  onChanged,
}: {
  license: License;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<ActivationRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<{ license: { licenseActivations: ActivationRow[] } }>(
        `/licenses/lookup?key=${encodeURIComponent(license.key)}`,
      );
      setRows(data.license.licenseActivations);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deactivate(instanceId: string) {
    setBusy(instanceId);
    setErr(null);
    try {
      await api('/licenses/deactivate', {
        method: 'POST',
        body: JSON.stringify({ key: license.key, instanceId }),
      });
      await load();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const live = (rows ?? []).filter((r) => !r.deactivatedAt);

  return (
    <Modal title="Activated devices" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
          <code className="flex-1 truncate font-mono text-xs">{license.key}</code>
          <StatusPill status={license.status} />
        </div>
        {err && <ErrorBox>{err}</ErrorBox>}
        {!rows ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : live.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No devices activated.</p>
        ) : (
          <ul className="space-y-2">
            {live.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <code className="block truncate font-mono text-xs">{r.instanceId}</code>
                  <span className="text-[11px] text-muted-foreground">
                    Activated {new Date(r.activatedAt).toLocaleString()}
                  </span>
                </div>
                {license.status === 'active' && (
                  <Button
                    variant="secondary"
                    loading={busy === r.instanceId}
                    onClick={() => deactivate(r.instanceId)}
                  >
                    Deactivate
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {live.length} of {license.maxActivations} activation{license.maxActivations === 1 ? '' : 's'} in use.
        </p>
      </div>
    </Modal>
  );
}
