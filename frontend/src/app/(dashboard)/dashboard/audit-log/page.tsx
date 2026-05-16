'use client';

import { useEffect, useState } from 'react';
import { Loader2, ScrollText } from 'lucide-react';
import { api, type AuditEntry } from '@/lib/api';
import { ErrorBox } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ entries: AuditEntry[] }>(`/audit-log?limit=100`)
      .then((d) => setRows(d.entries))
      .catch((e) => setError((e as Error).message));
  }, []);

  const columns: Column<AuditEntry>[] = [
    {
      key: 'when',
      header: 'When',
      sortable: true,
      sortValue: (e) => new Date(e.createdAt).getTime(),
      cell: (e) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(e.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      sortable: true,
      sortValue: (e) => e.actorEmail ?? e.actorType,
      searchValue: (e) => `${e.actorEmail ?? ''} ${e.actorType} ${e.actorId ?? ''} ${e.action} ${e.targetType ?? ''} ${e.targetId ?? ''} ${e.ip ?? ''}`,
      cell: (e) => (
        <div className="text-xs">
          <p className="font-medium">{e.actorEmail ?? e.actorType}</p>
          {e.actorId && <p className="font-mono text-[10px] text-muted-foreground">{e.actorId}</p>}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      sortValue: (e) => e.action,
      cell: (e) => <span className="font-mono text-xs">{e.action}</span>,
    },
    {
      key: 'target',
      header: 'Target',
      sortable: true,
      sortValue: (e) => e.targetType ?? '',
      cell: (e) => (
        <div className="text-xs">
          {e.targetType ? (
            <>
              <p className="font-medium">{e.targetType}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{e.targetId}</p>
            </>
          ) : '—'}
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      cell: (e) => <span className="font-mono text-xs text-muted-foreground">{e.ip ?? '—'}</span>,
    },
  ];

  const filters: FilterDef<AuditEntry>[] = [
    { key: 'actorType', label: 'Actor type', accessor: (e) => e.actorType },
    { key: 'targetType', label: 'Target type', accessor: (e) => e.targetType ?? '' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every state-changing action across warehouses, stock, shipments, licenses, deliveries — actor, IP, timestamp, before/after.
        </p>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {!rows && !error ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
          <ScrollText className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No entries yet</p>
        </div>
      ) : rows && rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={columns}
          filters={filters}
          rowKey={(e) => e.id}
          searchPlaceholder="Search action, actor, target…"
          defaultSort={{ key: 'when', dir: 'desc' }}
          empty="No entries match."
        />
      ) : null}
    </div>
  );
}
