'use client';

import { useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { api, type Delivery } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { ErrorBox, Loading, EmptyState } from '@/components/dashboard/ui';

export default function DeliveriesPage() {
  const [rows, setRows] = useState<Delivery[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ deliveries: Delivery[] }>('/deliveries')
      .then((d) => setRows(d.deliveries))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        icon={PackageCheck}
        title="Digital Deliveries"
        description="Per-order download tracking. Buyers get a unique download URL after Plugipay confirms payment."
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <EmptyState>No deliveries yet.</EmptyState>}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Checkout</th>
                <th className="px-4 py-3 text-right font-medium">Downloads</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const expired = new Date(d.expiresAt) < new Date();
                const exhausted = d.downloadCount >= d.maxDownloads;
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono text-xs">{d.productId}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.customerId}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.checkoutSessionId}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono tabular-nums ${exhausted ? 'text-destructive' : ''}`}>
                        {d.downloadCount} / {d.maxDownloads}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={expired ? 'text-destructive' : 'text-muted-foreground'}>
                        {new Date(d.expiresAt).toLocaleDateString()}
                        {expired && ' · expired'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
