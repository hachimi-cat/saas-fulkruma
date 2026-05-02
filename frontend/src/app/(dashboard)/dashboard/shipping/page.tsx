'use client';

import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { api, type BiteshipConfig, type CustomerAddress } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Field, ErrorBox, Loading, Button } from '@/components/dashboard/ui';

const COURIER_LABELS: Record<string, string> = {
  jne: 'JNE', sicepat: 'SiCepat', ide: 'ID Express', jnt: 'J&T',
  anteraja: 'Anteraja', pos: 'Pos Indonesia', lion: 'Lion Parcel', ninja: 'Ninja Xpress',
};

export default function ShippingPage() {
  const [config, setConfig] = useState<BiteshipConfig | null>(null);
  const [allCouriers, setAllCouriers] = useState<string[]>([]);
  const [origins, setOrigins] = useState<CustomerAddress[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // form state
  const [apiKey, setApiKey] = useState('');
  const [defaultOriginId, setDefaultOriginId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [defaultCourier, setDefaultCourier] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  async function reload() {
    try {
      const [cfg, addr] = await Promise.all([
        api<{ config: BiteshipConfig | null; couriers: string[] }>('/shipping/config'),
        api<{ addresses: CustomerAddress[] }>('/addresses'),
      ]);
      setAllCouriers(cfg.couriers);
      setOrigins(addr.addresses);
      if (cfg.config) {
        setConfig(cfg.config);
        setDefaultOriginId(cfg.config.defaultOriginId);
        setEnabled(cfg.config.enabledCouriers);
        setDefaultCourier(cfg.config.defaultCourier);
        setActive(cfg.config.active);
      }
      setLoaded(true);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setMsg(null);
    try {
      const body: Record<string, unknown> = {
        defaultOriginId,
        enabledCouriers: enabled,
        defaultCourier,
        active,
      };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      await api('/shipping/config', { method: 'PUT', body: JSON.stringify(body) });
      setApiKey('');
      setMsg('Saved.');
      reload();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  function toggle(c: string) {
    setEnabled((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={Send}
        title="Shipping"
        description="Biteship integration — paste your API key, pick which couriers your storefront offers."
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!loaded && !error && <Loading />}

      {loaded && (
        <form onSubmit={save} className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Biteship API key</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Get one from biteship.com → Settings → API. Pasting a new key replaces the existing one.
            </p>
            <div className="mt-4 space-y-3">
              <Field label="API key" hint={config?.apiKeyConfigured ? `Currently configured: ${config.apiKeyPreview}` : 'Not configured.'}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config?.apiKeyConfigured ? '•••• keep current' : 'biteship_…'}
                  className="input font-mono"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <span>Active — when off, shipment.create returns 503 to the storefront.</span>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Default origin</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a CustomerAddress to use as the pickup origin when storlaunch creates shipments.
            </p>
            <div className="mt-4">
              <Field label="Origin">
                <select value={defaultOriginId ?? ''} onChange={(e) => setDefaultOriginId(e.target.value || null)} className="input">
                  <option value="">— none —</option>
                  {origins.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label} · {o.address.slice(0, 40)}
                      {o.address.length > 40 ? '…' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Couriers offered at checkout</h2>
            <p className="mt-1 text-xs text-muted-foreground">Toggle which couriers your buyers see. The default is selected on first load.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {allCouriers.map((c) => (
                <label key={c} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition cursor-pointer ${
                  enabled.includes(c) ? 'border-brand-500 bg-brand-50' : 'border-border bg-card hover:bg-secondary'
                }`}>
                  <input
                    type="checkbox"
                    checked={enabled.includes(c)}
                    onChange={() => toggle(c)}
                  />
                  <span>{COURIER_LABELS[c] ?? c}</span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <Field label="Default courier">
                <select value={defaultCourier ?? ''} onChange={(e) => setDefaultCourier(e.target.value || null)} className="input">
                  <option value="">— none —</option>
                  {enabled.map((c) => <option key={c} value={c}>{COURIER_LABELS[c] ?? c}</option>)}
                </select>
              </Field>
            </div>
          </section>

          {msg && <p className="text-xs font-medium text-emerald-700">{msg}</p>}

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      )}
    </div>
  );
}
