'use client';

import { useEffect, useState } from 'react';
import { Wallet, Plus, Truck, RefreshCcw, ArrowUpRight, ArrowDownRight, Sparkles, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { ErrorBox, Loading } from '@/components/dashboard/ui';

const PRESET_AMOUNTS = [50_000, 100_000, 250_000, 500_000, 1_000_000];

function TopUpForm({ onError, onComplete }: { onError: (msg: string | null) => void; onComplete: () => void }) {
  const [amount, setAmount] = useState<number>(100_000);
  const [email, setEmail] = useState('');
  const [needsEmail, setNeedsEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    onError(null);
    try {
      const body: { amount: number; email?: string } = { amount };
      if (needsEmail && email.trim()) body.email = email.trim();
      const res = await api<{ checkoutUrl?: string }>('/shipping-credits/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        onError('No checkout URL returned');
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'EMAIL_REQUIRED') {
        setNeedsEmail(true);
        onError('First top-up needs an email — enter one below and try again.');
      } else {
        onError(err.message ?? 'Top-up failed');
      }
    } finally {
      setBusy(false);
      onComplete();
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Top up balance</h2>
        <p className="mt-0.5 text-xs text-slate-600">
          You&apos;ll be redirected to checkout — pay via QRIS, virtual account,
          e-wallet, or card. Credit applies as soon as payment clears.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESET_AMOUNTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={`rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors ${
              amount === p ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Rp {p.toLocaleString('id-ID')}
          </button>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Custom amount (IDR)</label>
        <input
          type="number"
          value={amount}
          min={10_000}
          max={10_000_000}
          step={10_000}
          onChange={(e) => setAmount(Math.max(10_000, Number(e.target.value) || 0))}
          className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-[10px] text-slate-500">Min Rp 10,000 · Max Rp 10,000,000 per top-up.</p>
      </div>
      {needsEmail && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Email for receipt <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-[10px] text-slate-500">One-time — saved on your Plugipay customer record for future top-ups.</p>
        </div>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy || amount < 10_000 || (needsEmail && !email.trim())}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Top up Rp {amount.toLocaleString('id-ID')}
      </button>
    </div>
  );
}

// S-048b: Fulkruma standalone-portal view of shipping credits.
// Mirror of Storlaunch's page, but for merchants using Fulkruma
// directly (no Storlaunch in front). Top-up flow on this side is a
// stub — standalone Fulkruma billing isn't wired to Plugipay yet; for
// now we surface a contact-us callout when the merchant wants to top
// up. Once standalone billing is wired we'll replace the button with a
// real checkout flow.

interface Balance {
  accountId: string;
  balance: number;
  updatedAt: string;
}

interface Transaction {
  id: string;
  kind: 'topup' | 'shipment_charge' | 'shipment_refund' | 'manual_adjustment';
  amount: number;
  balanceAfter: number;
  shipmentId: string | null;
  externalRef: string | null;
  memo: string | null;
  createdAt: string;
}

const KIND_META: Record<Transaction['kind'], { label: string; icon: typeof Plus; tone: string }> = {
  topup: { label: 'Top up', icon: ArrowUpRight, tone: 'text-emerald-600' },
  shipment_charge: { label: 'Shipment charge', icon: Truck, tone: 'text-blue-600' },
  shipment_refund: { label: 'Refund', icon: ArrowDownRight, tone: 'text-amber-600' },
  manual_adjustment: { label: 'Adjustment', icon: Sparkles, tone: 'text-slate-500' },
};

function formatIDR(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}

export default function ShippingCreditsPage() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const [b, t] = await Promise.all([
        api<Balance>('/shipping-credits'),
        api<{ data: Transaction[]; nextCursor: string | null }>('/shipping-credits/transactions?limit=30'),
      ]);
      setBalance(b);
      setTransactions(t.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const balanceAmount = balance?.balance ?? 0;
  const balanceLow = balanceAmount < 50_000;

  return (
    <div>
      <PageHeader
        icon={Wallet}
        title="Shipping Credits"
        description="Prepaid balance used to dispatch couriers via Biteship. Each confirmed pickup debits this balance based on the courier rate at booking time."
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!balance && !error && <Loading />}

      {balance && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
            <div className={`rounded-xl border bg-white p-6 ${balanceLow ? 'border-amber-400' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <Wallet className="h-3.5 w-3.5" />
                Current balance
              </div>
              <p className={`mt-2 text-3xl font-bold tabular-nums ${balanceLow ? 'text-amber-600' : 'text-slate-900'}`}>
                {formatIDR(balanceAmount)}
              </p>
              {balanceLow && (
                <p className="mt-2 text-xs text-amber-700">
                  Balance is low. Top up so the next pickup confirmation doesn&apos;t fail.
                </p>
              )}
              <button
                type="button"
                onClick={() => void load()}
                disabled={refreshing}
                className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
              >
                {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                Refresh
              </button>
            </div>

            <TopUpForm onError={(m) => setError(m)} onComplete={load} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">Transactions</h2>
              <p className="mt-0.5 text-xs text-slate-500">Most recent first.</p>
            </div>
            {!transactions || transactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No transactions yet.</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {transactions.map((t) => {
                  const meta = KIND_META[t.kind];
                  const Icon = meta.icon;
                  const isCredit = t.amount > 0;
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 ${meta.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{meta.label}</p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(t.createdAt)}
                            {t.memo && <> · {t.memo}</>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold tabular-nums ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {isCredit ? '+' : ''}{formatIDR(t.amount)}
                        </p>
                        <p className="text-[10px] text-slate-500 tabular-nums">
                          Balance: {formatIDR(t.balanceAfter)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
