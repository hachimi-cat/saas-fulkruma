'use client';

import { useEffect, useState, useMemo } from 'react';
import { api, type BiteshipCourier } from '@/lib/api';
import { Loader2, Save, MapPin, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { LocationForm, type LocationValue } from '@/components/shipping/location-form';

interface CourierSummary {
  code: string;
  name: string;
  // Pick any service type to flag instant couriers. If ANY service type is
  // instant/same_day, the whole courier is treated as location-sensitive.
  type: string;
  services: BiteshipCourier[]; // raw rows for detail view
}

interface OriginResponse {
  address: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  village: string | null;
  postal: string | null;
  areaId: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  contactName: string | null;
  contactPhone: string | null;
  couriers: string[];
  configured: boolean;
}

function summarizeCouriers(rows: BiteshipCourier[]): CourierSummary[] {
  const byCode = new Map<string, CourierSummary>();
  for (const r of rows) {
    if (!byCode.has(r.courier_code)) {
      byCode.set(r.courier_code, {
        code: r.courier_code,
        name: r.courier_name,
        type: r.service_type,
        services: [r],
      });
    } else {
      const entry = byCode.get(r.courier_code)!;
      entry.services.push(r);
      // Promote to instant/same_day badge if ANY service is one of those.
      if (r.service_type === 'instant' || r.service_type === 'same_day') {
        entry.type = r.service_type;
      }
    }
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function isInstantType(type: string): boolean {
  return type === 'instant' || type === 'same_day';
}

export default function ShippingSettingsPage() {
  const [location, setLocation] = useState<LocationValue>({
    address: '', province: null, city: null, district: null, village: null,
    postal: null, lat: null, lng: null, note: null,
  });
  const [contact, setContact] = useState({ contactName: '', contactPhone: '' });
  const [couriers, setCouriers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dynamic courier catalog from Biteship — loaded once, cached on the backend 1h.
  const [catalog, setCatalog] = useState<CourierSummary[]>([]);
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    Promise.all([
      api<OriginResponse>('/shipping/origin'),
      api<BiteshipCourier[]>('/shipping/couriers').catch(() => {
        setCatalogError('Could not fetch live courier list from Biteship. Showing saved selections only.');
        return [] as BiteshipCourier[];
      }),
    ])
      .then(([d, couriersRes]) => {
        const summaries = summarizeCouriers(couriersRes);
        setCatalog(summaries);
        const allCodes = summaries.map((s) => s.code);
        setLocation({
          address: d.address ?? '',
          province: d.province ?? null,
          city: d.city ?? null,
          district: d.district ?? null,
          village: d.village ?? null,
          postal: d.postal ?? null,
          lat: d.lat ?? null,
          lng: d.lng ?? null,
          note: d.note ?? null,
        });
        setContact({ contactName: d.contactName ?? '', contactPhone: d.contactPhone ?? '' });
        setCouriers(d.couriers?.length ? d.couriers : allCodes);
      })
      .catch(() => setError('Failed to load shipping settings'))
      .finally(() => setLoading(false));
  }, []);

  const instantCouriers = useMemo(
    () => new Set(catalog.filter((c) => isInstantType(c.type)).map((c) => c.code)),
    [catalog]
  );
  const hasInstantEnabled = useMemo(
    () => couriers.some((c) => instantCouriers.has(c)),
    [couriers, instantCouriers]
  );
  const hasCoords = location.lat != null && location.lng != null;
  const needsCoordsWarning = hasInstantEnabled && !hasCoords;

  function toggleCourier(code: string) {
    setCouriers((curr) => curr.includes(code) ? curr.filter((c) => c !== code) : [...curr, code]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await api('/shipping/origin', {
        method: 'PATCH',
        body: JSON.stringify({
          address: location.address,
          province: location.province,
          city: location.city,
          district: location.district,
          village: location.village,
          postal: location.postal,
          lat: location.lat,
          lng: location.lng,
          note: location.note,
          contactName: contact.contactName,
          contactPhone: contact.contactPhone,
          couriers,
        }),
      });
      setSuccess('Shipping settings saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save shipping settings';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Shipping Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure pickup origin and enabled couriers. Powered by Biteship (16 Indonesian couriers).
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ─── Origin ───────────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-medium">Pickup Origin</h2>
          </div>

          <LocationForm value={location} onChange={setLocation} />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className="mb-1 block text-sm font-medium">Contact name</label>
              <input
                id="contact-name" type="text" required
                value={contact.contactName}
                onChange={(e) => setContact({ ...contact, contactName: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="contact-phone" className="mb-1 block text-sm font-medium">Contact phone</label>
              <input
                id="contact-phone" type="tel" required
                value={contact.contactPhone}
                onChange={(e) => setContact({ ...contact, contactPhone: e.target.value })}
                placeholder="081234567890"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Lat/lng required to enable instant couriers (GoSend, Grab, Lalamove, Borzo, Deliveree).
          </p>
        </section>

        {/* ─── Couriers ───────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">Enabled Couriers</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCouriers(catalog.map((c) => c.code))}
                className="text-xs text-primary hover:underline"
                disabled={catalog.length === 0}
              >
                Enable all
              </button>
              <button
                type="button"
                onClick={() => setCouriers([])}
                className="text-xs text-muted-foreground hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          {catalogError && (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              ⚠ {catalogError}
            </div>
          )}
          {needsCoordsWarning && (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
              ⚠ Instant couriers require origin latitude + longitude. Add coords above or disable instant couriers to save.
            </div>
          )}
          {catalog.length === 0 && !catalogError ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading courier catalog…</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((courier) => {
                const isInstant = isInstantType(courier.type);
                return (
                  <label
                    key={courier.code}
                    className="flex cursor-pointer items-center gap-2 rounded border border-border bg-background p-3 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={couriers.includes(courier.code)}
                      onChange={() => toggleCourier(courier.code)}
                      className="h-4 w-4"
                    />
                    <span className="font-medium">{courier.name}</span>
                    <span className={`ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                      isInstant ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isInstant && <Zap className="h-3 w-3" />}
                      {courier.type}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
