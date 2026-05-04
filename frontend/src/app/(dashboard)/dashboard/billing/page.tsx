'use client';

import { useEffect, useState } from 'react';
import { Wallet, Check, Loader2, AlertTriangle, CreditCard, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button, ErrorBox } from '@/components/dashboard/ui';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
}

interface Subscription {
  plan: string;
  planName: string;
  isForjioInternal: boolean;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
}

interface Usage {
  plan: string;
  ordersFulfilled: number;
  ordersLimit: number;
  shipmentsCreated: number;
  licensesIssued: number;
  resetAt: string;
}

interface Invoice {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

interface InvoicePage {
  data: Invoice[];
  cursor: string | null;
  hasMore: boolean;
}

function fmtIDR(amount: number): string {
  if (amount === 0) return 'Rp 0';
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}k`;
  return `Rp ${amount}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const PLAN_ORDER = ['free', 'starter', 'growth', 'scale'];

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() {
    try {
      const [p, s, u, i] = await Promise.all([
        api<Plan[]>('/billing/plans'),
        api<Subscription>('/billing/subscription'),
        api<Usage>('/billing/usage'),
        api<InvoicePage>('/billing/invoices?limit=20'),
      ]);
      setPlans(p);
      setSub(s);
      setUsage(u);
      setInvoices(i.data);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { reload(); }, []);

  async function checkout(planId: string) {
    setWorking(planId);
    setNotice(null);
    try {
      const result = await api<{ checkoutUrl?: string; status?: string }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan: planId.toUpperCase() }),
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setNotice('Plan updated.');
        await reload();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(null);
    }
  }

  async function cancel() {
    if (!confirm('Cancel your subscription? You will be moved to Free at the end of the billing period.')) return;
    setWorking('cancel');
    setNotice(null);
    try {
      await api('/billing/cancel', { method: 'POST' });
      setNotice('Subscription will cancel at period end.');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(null);
    }
  }

  const isLoading = !plans || !sub || !usage || !invoices;
  const isInternal = sub?.isForjioInternal ?? false;
  const currentPlanSlug = (sub?.plan ?? 'free').toLowerCase();

  return (
    <div className="">
      <PageHeader
        icon={Wallet}
        title="Billing"
        description="Plan, usage, and invoices. Billing is processed by Plugipay."
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {notice && (
        <div className="mb-6 rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      {isLoading && !error && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (
        <>
          {isInternal && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-3">
              <Zap className="h-5 w-5 shrink-0 text-brand-500" />
              <p className="text-sm">
                <span className="font-semibold">Forjio-internal workspace.</span>{' '}
                <span className="text-muted-foreground">Unlimited everything. Plan changes are waived.</span>
              </p>
            </div>
          )}

          {sub?.cancelAt && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-sm">
                Your plan ends on <span className="font-semibold">{fmtDate(sub.cancelAt)}</span>. You&rsquo;ll move to Free after that.
              </p>
            </div>
          )}

          <section className="mb-8 rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</p>
                <p className="mt-1 text-2xl font-semibold">{sub?.planName ?? 'Free'}</p>
                {sub?.currentPeriodEnd && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Current period ends {fmtDate(sub.currentPeriodEnd)}
                  </p>
                )}
              </div>
              {!isInternal && currentPlanSlug !== 'free' && !sub?.cancelAt && (
                <Button onClick={cancel} variant="ghost" disabled={working === 'cancel'}>
                  {working === 'cancel' && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cancel subscription
                </Button>
              )}
            </div>

            <div className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
              <UsageCell label="Orders fulfilled" current={usage!.ordersFulfilled} limit={usage!.ordersLimit} />
              <UsageCell label="Shipments created" current={usage!.shipmentsCreated} limit={-1} />
              <UsageCell label="Licenses issued" current={usage!.licensesIssued} limit={-1} />
            </div>
          </section>

          {!isInternal && plans && plans.length > 0 && (
            <>
              <h2 className="mb-3 text-sm font-semibold tracking-tight">Change plan</h2>
              <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[...plans].sort((a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id)).map((p) => {
                  const isCurrent = p.id === currentPlanSlug;
                  const popular = p.id === 'starter';
                  const canUpgrade = !isCurrent && p.id !== 'free';
                  return (
                    <div
                      key={p.id}
                      className={`relative rounded-xl border bg-card p-5 ${popular ? 'border-brand-500 shadow-md' : 'border-border'}`}
                    >
                      {popular && (
                        <span className="absolute -top-2.5 left-5 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                          Most popular
                        </span>
                      )}
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">{fmtIDR(p.price)}</p>
                      <p className="text-xs text-muted-foreground">{p.id === 'free' ? 'forever' : 'per month'}</p>
                      <ul className="mt-4 space-y-1.5 text-sm">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check size={14} className="mt-0.5 shrink-0 text-brand-500" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-5">
                        {isCurrent ? (
                          <span className="inline-block rounded-md bg-secondary px-3 py-1.5 text-xs font-medium">Current</span>
                        ) : canUpgrade ? (
                          <Button onClick={() => checkout(p.id)} disabled={working === p.id}>
                            {working === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Upgrade
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Cancel current plan to downgrade</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold tracking-tight">Invoice history</h2>
            {invoices!.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                <CreditCard className="h-10 w-10 opacity-40" />
                <p className="mt-3 text-sm">No invoices yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">Date</th>
                    <th className="px-2 py-2 text-left font-medium">Plan</th>
                    <th className="px-2 py-2 text-left font-medium">Amount</th>
                    <th className="px-2 py-2 text-left font-medium">Status</th>
                    <th className="px-2 py-2 text-right font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices!.map((inv) => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-2 py-2">{fmtDate(inv.createdAt)}</td>
                      <td className="px-2 py-2 capitalize">{inv.plan}</td>
                      <td className="px-2 py-2 font-mono">{fmtIDR(inv.amount)}</td>
                      <td className="px-2 py-2 capitalize">{inv.status.toLowerCase()}</td>
                      <td className="px-2 py-2 text-right">
                        {inv.receiptUrl ? (
                          <a href={inv.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">View</a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function UsageCell({ label, current, limit }: { label: string; current: number; limit: number }) {
  const display = limit === -1 ? `${current.toLocaleString()}` : `${current.toLocaleString()} / ${limit.toLocaleString()}`;
  const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{display}</p>
      {limit > 0 && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
