'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Plus, Power, PowerOff, Trash2, Webhook } from 'lucide-react';
import { api, type WebhookEndpoint, type WebhookEventRow } from '@/lib/api';
import { Modal, Field, ErrorBox, Button, StatusPill } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';
import { PageHeader } from '@/components/dashboard/page-header';

const EVENT_TYPES = [
  '*',
  'fulkruma.shipment.created.v1',
  'fulkruma.shipment.updated.v1',
  'fulkruma.shipment.delivered.v1',
  'fulkruma.shipment.*',
  'fulkruma.license.issued.v1',
  'fulkruma.license.revoked.v1',
  'fulkruma.license.*',
  'fulkruma.delivery.created.v1',
  'fulkruma.stock.adjusted.v1',
];

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[] | null>(null);
  const [events, setEvents] = useState<WebhookEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'endpoints' | 'events'>('endpoints');
  const [created, setCreated] = useState<{ endpoint: WebhookEndpoint; secret: string } | null>(null);

  async function reload() {
    try {
      const [eps, evs] = await Promise.all([
        api<{ endpoints: WebhookEndpoint[] }>('/webhooks/endpoints?limit=100'),
        api<{ events: WebhookEventRow[] }>('/webhooks/events?limit=100'),
      ]);
      setEndpoints(eps.endpoints);
      setEvents(evs.events);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function toggleActive(ep: WebhookEndpoint) {
    try { await api(`/webhooks/endpoints/${ep.id}`, { method: 'PATCH', body: JSON.stringify({ active: !ep.active }) }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  async function remove(ep: WebhookEndpoint) {
    if (!confirm(`Delete webhook ${ep.url}?`)) return;
    try { await api(`/webhooks/endpoints/${ep.id}`, { method: 'DELETE' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  const endpointColumns: Column<WebhookEndpoint>[] = [
    {
      key: 'url',
      header: 'URL',
      sortable: true,
      sortValue: (ep) => ep.url,
      searchValue: (ep) => `${ep.url} ${ep.description ?? ''} ${ep.events.join(' ')}`,
      cell: (ep) => (
        <div>
          <p className="font-medium break-all">{ep.url}</p>
          {ep.description && <p className="mt-0.5 text-xs text-muted-foreground">{ep.description}</p>}
        </div>
      ),
    },
    {
      key: 'events',
      header: 'Events',
      cell: (ep) => (
        <span className="text-xs">
          {ep.events.slice(0, 3).map((e) => (
            <span key={e} className="mr-1 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono">{e}</span>
          ))}
          {ep.events.length > 3 && <span className="text-muted-foreground">+{ep.events.length - 3}</span>}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      sortable: true,
      sortValue: (ep) => (ep.active ? '0' : '1'),
      cell: (ep) => (
        <button
          onClick={() => toggleActive(ep)}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
            ep.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-secondary text-muted-foreground'
          }`}
        >
          {ep.active ? <Power size={11} /> : <PowerOff size={11} />}
          {ep.active ? 'on' : 'off'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (ep) => (
        <button onClick={() => remove(ep)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive">
          <Trash2 size={12} /> Delete
        </button>
      ),
    },
  ];

  const endpointFilters: FilterDef<WebhookEndpoint>[] = [
    {
      key: 'active',
      label: 'Active',
      accessor: (ep) => (ep.active ? 'on' : 'off'),
      options: [
        { value: 'on', label: 'Active' },
        { value: 'off', label: 'Disabled' },
      ],
    },
  ];

  const eventColumns: Column<WebhookEventRow>[] = [
    {
      key: 'when',
      header: 'When',
      sortable: true,
      sortValue: (e) => new Date(e.createdAt).getTime(),
      cell: (e) => <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      sortValue: (e) => e.type,
      searchValue: (e) => `${e.type} ${e.status}`,
      cell: (e) => <span className="font-mono text-xs">{e.type}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (e) => e.status,
      cell: (e) => <StatusPill status={e.status} />,
    },
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'right',
      sortable: true,
      sortValue: (e) => e.attempts,
      cell: (e) => <span className="font-mono tabular-nums">{e.attempts}</span>,
    },
    {
      key: 'code',
      header: 'Code',
      align: 'right',
      sortable: true,
      sortValue: (e) => e.responseCode ?? 0,
      cell: (e) => <span className="font-mono tabular-nums">{e.responseCode ?? '—'}</span>,
    },
  ];

  const eventFilters: FilterDef<WebhookEventRow>[] = [
    {
      key: 'status',
      label: 'Status',
      accessor: (e) => e.status,
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'sent', label: 'Sent' },
        { value: 'failed', label: 'Failed' },
      ],
    },
    { key: 'type', label: 'Type', accessor: (e) => e.type },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Webhooks"
        description="Outbound webhook endpoints. HMAC-SHA256-signed, retried with exponential backoff."
        action={<Button onClick={() => setShowForm(true)}><Plus size={14} /> New endpoint</Button>}
      />

      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {(['endpoints', 'events'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'endpoints' ? `Endpoints (${endpoints?.length ?? 0})` : `Recent events (${events?.length ?? 0})`}
          </button>
        ))}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {tab === 'endpoints' && (
        !endpoints && !error ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : endpoints && endpoints.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
            <Webhook className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No endpoints yet</p>
          </div>
        ) : endpoints && endpoints.length > 0 ? (
          <DataTable
            rows={endpoints}
            columns={endpointColumns}
            filters={endpointFilters}
            rowKey={(ep) => ep.id}
            searchPlaceholder="Search URL, description, event…"
            defaultSort={{ key: 'url', dir: 'asc' }}
            empty="No endpoints match."
          />
        ) : null
      )}

      {tab === 'events' && (
        !events && !error ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : events && events.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
            <Webhook className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No webhook events delivered yet</p>
          </div>
        ) : events && events.length > 0 ? (
          <DataTable
            rows={events}
            columns={eventColumns}
            filters={eventFilters}
            rowKey={(e) => e.id}
            searchPlaceholder="Search type, status…"
            defaultSort={{ key: 'when', dir: 'desc' }}
            empty="No events match."
          />
        ) : null
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

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { endpoint: WebhookEndpoint; secret: string }) => void }) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState<string[]>(['*']);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(e: string) {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitting(true); setErr(null);
    try {
      const data = await api<{ endpoint: WebhookEndpoint; secret: string }>('/webhooks/endpoints', {
        method: 'POST', body: JSON.stringify({ url, description: description || undefined, events }),
      });
      onCreated(data);
    } catch (e) { setErr((e as Error).message); setSubmitting(false); }
  }

  return (
    <Modal title="New webhook endpoint" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Field label="URL *">
          <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="input font-mono" placeholder="https://..." />
        </Field>
        <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} className="input" /></Field>
        <Field label="Events *" hint="Use '*' for everything, or pick specific event types.">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {EVENT_TYPES.map((e) => (
              <label key={e} className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs cursor-pointer ${
                events.includes(e) ? 'border-brand-500 bg-brand-50' : 'border-border bg-card hover:bg-secondary'
              }`}>
                <input type="checkbox" checked={events.includes(e)} onChange={() => toggle(e)} />
                <span className="font-mono">{e}</span>
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

function CreatedSecret({ data, onClose }: { data: { endpoint: WebhookEndpoint; secret: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="Save the signing secret" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Verify inbound requests by computing <code className="font-mono">HMAC-SHA256(`${'${ts}'}.${'${rawBody}'}`)</code> with this secret.
          The header is <code className="font-mono">Fulkruma-Signature: t=…,v1=…</code>.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <code className="flex-1 font-mono text-xs break-all">{data.secret}</code>
          <button onClick={() => { navigator.clipboard.writeText(data.secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-secondary">
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>I have saved it</Button>
        </div>
      </div>
    </Modal>
  );
}
