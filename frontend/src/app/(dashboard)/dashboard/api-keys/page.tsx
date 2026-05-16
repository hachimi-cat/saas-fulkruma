'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Plus } from 'lucide-react';
import { api, type ApiKey } from '@/lib/api';
import { Modal, Field, ErrorBox, Button } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';

export default function ApiKeysPage() {
  const [rows, setRows] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<{ apiKey: ApiKey; secret: string } | null>(null);

  async function reload() {
    try { setRows((await api<{ apiKeys: ApiKey[] }>('/api-keys?limit=100')).apiKeys); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function revoke(k: ApiKey) {
    if (!confirm(`Revoke "${k.name}"? Existing requests will start failing immediately.`)) return;
    try { await api(`/api-keys/${k.id}/revoke`, { method: 'POST' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  const columns: Column<ApiKey>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (k) => k.name,
      searchValue: (k) => `${k.name} ${k.keyId} ${k.scopes.join(' ')}`,
      cell: (k) => <span className="font-medium">{k.name}</span>,
    },
    {
      key: 'keyId',
      header: 'Key ID',
      sortable: true,
      sortValue: (k) => k.keyId,
      cell: (k) => <span className="font-mono text-xs">{k.keyId}</span>,
    },
    {
      key: 'scopes',
      header: 'Scopes',
      cell: (k) => (
        <span className="text-xs text-muted-foreground">
          {k.scopes.map((s) => (
            <span key={s} className="mr-1 rounded-md border border-border bg-background px-1.5 py-0.5">{s}</span>
          ))}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      sortValue: (k) => new Date(k.createdAt).getTime(),
      cell: (k) => <span className="text-xs text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: 'lastUsed',
      header: 'Last used',
      sortable: true,
      sortValue: (k) => (k.lastUsedAt ? new Date(k.lastUsedAt).getTime() : 0),
      cell: (k) => <span className="text-xs text-muted-foreground">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      sortable: true,
      sortValue: (k) => (k.revokedAt ? 'revoked' : 'active'),
      cell: (k) => (
        <span className="text-xs">
          {k.revokedAt ? (
            <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 font-mono uppercase tracking-wider text-destructive">revoked</span>
          ) : (
            <button onClick={() => revoke(k)} className="font-medium text-muted-foreground hover:text-destructive">Revoke</button>
          )}
        </span>
      ),
    },
  ];

  const filters: FilterDef<ApiKey>[] = [
    {
      key: 'status',
      label: 'Status',
      accessor: (k) => (k.revokedAt ? 'revoked' : 'active'),
      options: [
        { value: 'active', label: 'Active' },
        { value: 'revoked', label: 'Revoked' },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">API Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            HMAC keys to call the Fulkruma API server-to-server. Scoped per workspace, rotatable, audit-logged.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={14} /> New key</Button>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {!rows && !error ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
          <KeyRound className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No API keys yet</p>
        </div>
      ) : rows && rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={columns}
          filters={filters}
          rowKey={(k) => k.id}
          searchPlaceholder="Search name, key id, scope…"
          defaultSort={{ key: 'createdAt', dir: 'desc' }}
          empty="No keys match."
        />
      ) : null}

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
