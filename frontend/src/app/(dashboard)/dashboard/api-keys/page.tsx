'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Plus, Copy, Check } from 'lucide-react';
import { api, type ApiKey } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Modal, Field, ErrorBox, Loading, EmptyState, Button } from '@/components/dashboard/ui';

export default function ApiKeysPage() {
  const [rows, setRows] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<{ apiKey: ApiKey; secret: string } | null>(null);

  async function reload() {
    try { setRows((await api<{ apiKeys: ApiKey[] }>('/api-keys')).apiKeys); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function revoke(k: ApiKey) {
    if (!confirm(`Revoke "${k.name}"? Existing requests will start failing immediately.`)) return;
    try { await api(`/api-keys/${k.id}/revoke`, { method: 'POST' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="">
      <PageHeader
        icon={KeyRound}
        title="API Keys"
        description="HMAC keys to call the Fulkruma API server-to-server. Scoped per workspace, rotatable, audit-logged."
        action={<Button onClick={() => setShowForm(true)}><Plus size={14} /> New key</Button>}
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <EmptyState>No API keys yet — create one for your CLI or server.</EmptyState>}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Key ID</th>
                <th className="px-4 py-3 text-left font-medium">Scopes</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Last used</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{k.keyId}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {k.scopes.map((s) => (
                      <span key={s} className="mr-1 rounded-md border border-border bg-background px-1.5 py-0.5">{s}</span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right text-xs">
                    {k.revokedAt ? (
                      <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 font-mono uppercase tracking-wider text-destructive">revoked</span>
                    ) : (
                      <button onClick={() => revoke(k)} className="font-medium text-muted-foreground hover:text-destructive">Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <CreateForm
          onClose={() => setShowForm(false)}
          onCreated={(c) => { setShowForm(false); setCreated(c); reload(); }}
        />
      )}

      {created && <CreatedSecret data={created} onClose={() => setCreated(null)} />}
    </div>
  );
}

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { apiKey: ApiKey; secret: string }) => void }) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read', 'write']);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setErr(null);
    try {
      const data = await api<{ apiKey: ApiKey; secret: string }>('/api-keys', {
        method: 'POST', body: JSON.stringify({ name, scopes }),
      });
      onCreated(data);
    } catch (e) { setErr((e as Error).message); setSubmitting(false); }
  }

  function toggle(s: string) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <Modal title="New API key" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Field label="Name *" hint="What this key is for — e.g. 'Storlaunch prod', 'CI deploys'.">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="Scopes *">
          <div className="flex flex-wrap gap-2">
            {['read', 'write', 'admin'].map((s) => (
              <label key={s} className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer ${
                scopes.includes(s) ? 'border-brand-500 bg-brand-50' : 'border-border bg-card hover:bg-secondary'
              }`}>
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreatedSecret({ data, onClose }: { data: { apiKey: ApiKey; secret: string }; onClose: () => void }) {
  const [copied, setCopied] = useState<'id' | 'secret' | null>(null);
  function copy(text: string, which: 'id' | 'secret') {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }
  return (
    <Modal title="Save your secret now" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The secret is shown <strong>once</strong>. We only store a hash — once you close this dialog, you can&rsquo;t recover it.
        </p>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Key ID</p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
            <code className="flex-1 font-mono text-xs break-all">{data.apiKey.keyId}</code>
            <button onClick={() => copy(data.apiKey.keyId, 'id')} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-secondary">
              {copied === 'id' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Secret</p>
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <code className="flex-1 font-mono text-xs break-all">{data.secret}</code>
            <button onClick={() => copy(data.secret, 'secret')} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-secondary">
              {copied === 'secret' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>I have saved it</Button>
        </div>
      </div>
    </Modal>
  );
}
