'use client';

import { useEffect, useState } from 'react';
import { Archive, Loader2, Plus, Warehouse as WarehouseIcon } from 'lucide-react';
import { api, type Warehouse as Wh } from '@/lib/api';
import { Modal, Field, ErrorBox, Button } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';
import { PageHeader } from '@/components/dashboard/page-header';

export default function WarehousesPage() {
  const [rows, setRows] = useState<Wh[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Wh | null>(null);

  async function reload() {
    try { setRows((await api<{ warehouses: Wh[] }>('/warehouses?limit=100')).warehouses); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function archive(w: Wh) {
    if (!confirm(`Archive "${w.name}"? Stock history is preserved.`)) return;
    try { await api(`/warehouses/${w.id}`, { method: 'DELETE' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  const columns: Column<Wh>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (w) => w.name,
      searchValue: (w) => `${w.name} ${w.city ?? ''} ${w.phone ?? ''}`,
      cell: (w) => <span className="font-medium">{w.name}</span>,
    },
    {
      key: 'city',
      header: 'City',
      sortable: true,
      sortValue: (w) => w.city ?? '',
      cell: (w) => <span className="text-muted-foreground">{w.city ?? '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (w) => <span className="font-mono text-xs text-muted-foreground">{w.phone ?? '—'}</span>,
    },
    {
      key: 'default',
      header: 'Default',
      sortable: true,
      sortValue: (w) => (w.isDefault ? '0' : '1'),
      cell: (w) =>
        w.isDefault ? (
          <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            default
          </span>
        ) : null,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (w) => (
        <div className="inline-flex items-center gap-3">
          <button onClick={() => { setEditing(w); setShowForm(true); }} className="text-xs font-medium text-foreground hover:underline">Edit</button>
          <button onClick={() => archive(w)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive">
            <Archive size={12} /> Archive
          </button>
        </div>
      ),
    },
  ];

  const filters: FilterDef<Wh>[] = [
    {
      key: 'default',
      label: 'Default',
      accessor: (w) => (w.isDefault ? 'yes' : 'no'),
      options: [
        { value: 'yes', label: 'Default' },
        { value: 'no', label: 'Not default' },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Warehouses"
        description="Each physical or virtual location that holds stock."
        action={<Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={14} /> New warehouse</Button>}
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      {!rows && !error ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
          <WarehouseIcon className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No warehouses yet</p>
        </div>
      ) : rows && rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={columns}
          filters={filters}
          rowKey={(w) => w.id}
          searchPlaceholder="Search name, city, phone…"
          defaultSort={{ key: 'name', dir: 'asc' }}
          empty="No warehouses match."
        />
      ) : null}

      {showForm && (
        <WarehouseForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function WarehouseForm({ initial, onClose, onSaved }: { initial: Wh | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [postal, setPostal] = useState(initial?.postal ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setErr(null);
    const body = { name, address: address || null, city: city || null, postal: postal || null, phone: phone || null, isDefault };
    try {
      if (initial) await api(`/warehouses/${initial.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/warehouses', { method: 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (e) { setErr((e as Error).message); setSubmitting(false); }
  }

  return (
    <Modal title={initial ? 'Edit warehouse' : 'New warehouse'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Field label="Name *"><input required value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><input value={city ?? ''} onChange={(e) => setCity(e.target.value)} className="input" /></Field>
          <Field label="Postal"><input value={postal ?? ''} onChange={(e) => setPostal(e.target.value)} className="input" /></Field>
        </div>
        <Field label="Address"><textarea value={address ?? ''} onChange={(e) => setAddress(e.target.value)} className="input" rows={2} /></Field>
        <Field label="Phone"><input value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          <span>Mark as default warehouse</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
