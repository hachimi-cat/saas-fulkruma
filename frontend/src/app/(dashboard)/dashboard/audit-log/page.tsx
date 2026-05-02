'use client';

import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api, type AuditEntry } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { ErrorBox, Loading, EmptyState } from '@/components/dashboard/ui';

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const qs = filter ? `?action=${encodeURIComponent(filter)}` : '';
    api<{ entries: AuditEntry[] }>(`/audit-log${qs}`)
      .then((d) => setRows(d.entries))
      .catch((e) => setError((e as Error).message));
  }, [filter]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        icon={ScrollText}
        title="Audit Log"
        description="Every state-changing action across warehouses, stock, shipments, licenses, deliveries — actor, IP, timestamp, before/after."
      />

      <div className="mb-4 flex items-center gap-2">
        <input
          type="search"
          placeholder="Filter by action prefix (e.g. shipment, warehouse.created)…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input max-w-md"
        />
        {filter && <button onClick={() => setFilter('')} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <EmptyState>No matching entries.</EmptyState>}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">When</th>
                <th className="px-4 py-3 text-left font-medium">Actor</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Target</th>
                <th className="px-4 py-3 text-left font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-medium">{e.actorEmail ?? e.actorType}</p>
                    {e.actorId && <p className="font-mono text-[10px] text-muted-foreground">{e.actorId}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-3 text-xs">
                    {e.targetType ? (
                      <>
                        <p className="font-medium">{e.targetType}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{e.targetId}</p>
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
