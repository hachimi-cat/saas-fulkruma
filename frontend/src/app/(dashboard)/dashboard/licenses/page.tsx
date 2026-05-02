'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Plus, Copy, Check } from 'lucide-react';
import { api, type License } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Modal, Field, ErrorBox, Loading, EmptyState, Button, StatusPill } from '@/components/dashboard/ui';

export default function LicensesPage() {
  const [rows, setRows] = useState<License[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [issued, setIssued] = useState<License | null>(null);
  const [copied, setCopied] = useState(false);

  async function reload() {
    try { setRows((await api<{ licenses: License[] }>('/licenses')).licenses); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function revoke(l: License) {
    if (!confirm(`Revoke license ${l.key}? Buyers' apps will fail activation.`)) return;
    try { await api(`/licenses/${l.id}/revoke`, { method: 'POST' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="">
      <PageHeader
        icon={KeyRound}
        title="Licenses"
        description="Digital fulfilment — license keys minted on payment, activations tracked, revocation supported."
        action={<Button onClick={() => setShowForm(true)}><Plus size={14} /> Issue license</Button>}
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <EmptyState>No licenses yet.</EmptyState>}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Key</th>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-right font-medium">Activations</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{l.key}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.productId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.customerId}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {l.activations}/{l.maxActivations}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={l.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {l.status === 'active' && (
                      <button onClick={() => revoke(l)} className="text-xs font-medium text-muted-foreground hover:text-destructive">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <IssueForm
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
    </div>
  );
}

function IssueForm({ onClose, onSaved }: { onClose: () => void; onSaved: (l: License) => void }) {
  const [productId, setProductId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [maxActivations, setMaxActivations] = useState<number>(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        <Field label="Product ID *" hint="Storlaunch Product id."><input required value={productId} onChange={(e) => setProductId(e.target.value)} className="input font-mono" placeholder="prod_..." /></Field>
        <Field label="Customer ID *" hint="Storlaunch Customer id."><input required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input font-mono" placeholder="cust_..." /></Field>
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
          <Button type="submit" loading={submitting}>Issue</Button>
        </div>
      </form>
    </Modal>
  );
}
