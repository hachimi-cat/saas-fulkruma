'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Admin partner-usage viewer. Surfaces the backend's
// `GET /api/v1/admin/partner/usage` rollup through the admin data
// proxy (api/v1/console/[...path] → backend BFF with the admin session
// cookie). No secret in the browser — the admin session cookie is the
// credential, resolved by `adminGuard` Path A.
//
// This is a read-only surface: it does not provision workspaces or
// mutate rates. Net-new admin actions are intentionally out of scope.

const KNOWN_PARTNERS = ['storlaunch', 'ripllo'] as const;

interface MerchantRow {
  accountId: string;
  shipments: number;
  licensesIssued: number;
  deliveries: number;
  chargeableCents: number;
}
interface UsageRollup {
  partner: string;
  period: { from: string; to: string };
  totals: {
    shipments: number;
    licensesIssued: number;
    deliveries: number;
    chargeableCents: number;
  };
  byMerchant: MerchantRow[];
}

/** Default window — the current calendar month so far. */
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: first.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

function formatIdr(cents: number): string {
  // Backend rollup is in IDR "cents" (1/100 rupiah); show whole rupiah.
  return `Rp ${Math.round(cents / 100).toLocaleString('id-ID')}`;
}

function PartnerUsageView() {
  const searchParams = useSearchParams();
  const initialPartner = searchParams.get('partner') ?? KNOWN_PARTNERS[0];

  const [partner, setPartner] = useState<string>(
    KNOWN_PARTNERS.includes(initialPartner as (typeof KNOWN_PARTNERS)[number])
      ? initialPartner
      : KNOWN_PARTNERS[0],
  );
  const range = defaultRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [rollup, setRollup] = useState<UsageRollup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        partner,
        from: new Date(`${from}T00:00:00.000Z`).toISOString(),
        to: new Date(`${to}T23:59:59.999Z`).toISOString(),
      });
      const res = await fetch(`/api/v1/console/admin/partner/usage?${qs}`, {
        credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Usage load failed');
      setRollup(body?.data ?? null);
    } catch (e) {
      setError((e as Error).message);
      setRollup(null);
    } finally {
      setLoading(false);
    }
  }, [partner, from, to]);

  useEffect(() => {
    load();
    // Re-run only when the partner changes; date edits are applied via
    // the explicit "Apply" button below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner]);

  return (
    <div>
      <PageHeader
        title="Partner usage"
        description="Pattern-2 billing rollup — chargeable events per merchant for the selected partner and window."
      />

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Partner
          <Select value={partner} onValueChange={setPartner}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a partner" />
            </SelectTrigger>
            <SelectContent>
              {KNOWN_PARTNERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Apply
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading rollup…
        </div>
      )}

      {!loading && rollup && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <StatCard label="Shipments" value={rollup.totals.shipments} />
            <StatCard label="Licenses issued" value={rollup.totals.licensesIssued} />
            <StatCard label="Deliveries" value={rollup.totals.deliveries} />
            <StatCard label="Chargeable" value={formatIdr(rollup.totals.chargeableCents)} />
          </div>

          <div className="mt-8 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Merchant</th>
                  <th className="px-4 py-3 font-medium">Shipments</th>
                  <th className="px-4 py-3 font-medium">Licenses</th>
                  <th className="px-4 py-3 font-medium">Deliveries</th>
                  <th className="px-4 py-3 font-medium">Chargeable</th>
                </tr>
              </thead>
              <tbody>
                {rollup.byMerchant.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No provisioned merchants for this partner.
                    </td>
                  </tr>
                )}
                {rollup.byMerchant.map((m) => (
                  <tr key={m.accountId} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{m.accountId}</td>
                    <td className="px-4 py-3">{m.shipments}</td>
                    <td className="px-4 py-3">{m.licensesIssued}</td>
                    <td className="px-4 py-3">{m.deliveries}</td>
                    <td className="px-4 py-3">{formatIdr(m.chargeableCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && !rollup && !error && (
        <div className="mt-8 flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Building2 size={28} />
          <p className="text-sm">Pick a partner and window, then Apply.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export default function AdminPartnersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PartnerUsageView />
    </Suspense>
  );
}
