'use client';

import { useEffect, useState } from 'react';
import { Webhook, Plus, Copy, Check, Power, PowerOff, Trash2 } from 'lucide-react';
import { api, type WebhookEndpoint, type WebhookEventRow } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Modal, Field, ErrorBox, Loading, EmptyState, Button, StatusPill } from '@/components/dashboard/ui';

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
        api<{ endpoints: WebhookEndpoint[] }>('/webhooks/endpoints'),
        api<{ events: WebhookEventRow[] }>('/webhooks/events'),
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

  return (
    <div className="">
      <PageHeader
        icon={Webhook}
        title="Webhooks"
        description="Outbound webhook endpoints. HMAC-SHA256-signed, retried with exponential backoff."
        action={<Button onClick={() => setShowForm(true)}><Plus size={14} /> New endpoint</Button>}
      />

      <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-card p-1">
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
        <>
          {!endpoints && !error && <Loading />}
          {endpoints && endpoints.length === 0 && <EmptyState>No endpoints yet.</EmptyState>}
          {endpoints && endpoints.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">URL</th>
                    <th className="px-4 py-3 text-left font-medium">Events</th>
                    <th className="px-4 py-3 text-left font-medium">Active</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((ep) => (
                    <tr key={ep.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium break-all">{ep.url}</p>
                        {ep.description && <p className="mt-0.5 text-xs text-muted-foreground">{ep.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {ep.events.slice(0, 3).map((e) => (
                          <span key={e} className="mr-1 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono">
                            {e}
                          </span>
                        ))}
                        {ep.events.length > 3 && <span className="text-muted-foreground">+{ep.events.length - 3}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(ep)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
                            ep.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-secondary text-muted-foreground'
                          }`}
                        >
                          {ep.active ? <Power size={11} /> : <PowerOff size={11} />}
                          {ep.active ? 'on' : 'off'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => remove(ep)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive">
                          <Trash2 size={12} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'events' && (
        <>
          {!events && !error && <Loading />}
          {events && events.length === 0 && <EmptyState>No webhook events delivered yet.</EmptyState>}
          {events && events.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">When</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Attempts</th>
                    <th className="px-4 py-3 text-right font-medium">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-xs">{e.type}</td>
                      <td className="px-4 py-3"><StatusPill status={e.status} /></td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{e.attempts}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{e.responseCode ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
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
