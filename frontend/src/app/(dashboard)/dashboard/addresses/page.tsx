'use client';

import { useEffect, useState } from 'react';
import { Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { api, type CustomerAddress } from '@/lib/api';
import { Modal, Field, ErrorBox, Button } from '@/components/dashboard/ui';
import { DataTable, type Column, type FilterDef } from '@/components/data-table';

export default function AddressesPage() {
  const [rows, setRows] = useState<CustomerAddress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    try { setRows((await api<{ addresses: CustomerAddress[] }>('/addresses?limit=100')).addresses); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function remove(a: CustomerAddress) {
    if (!confirm(`Delete address "${a.label}" for ${a.contactName}?`)) return;
    try { await api(`/addresses/${a.id}`, { method: 'DELETE' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  const columns: Column<CustomerAddress>[] = [
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      sortValue: (a) => a.customerId,
      searchValue: (a) => `${a.customerId} ${a.contactName} ${a.label}`,
      cell: (a) => <span className="font-mono text-xs text-muted-foreground">{a.customerId}</span>,
    },
    {
      key: 'label',
      header: 'Label',
      sortable: true,
      sortValue: (a) => a.label,
      cell: (a) => (
        <span>
          <span className="font-medium">{a.label}</span>
          {a.isDefault && (
            <span className="ml-2 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              default
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      sortable: true,
      sortValue: (a) => a.contactName,
      cell: (a) => (
        <div className="text-xs">
          <p className="font-medium">{a.contactName}</p>
          <p className="text-muted-foreground">{a.contactPhone}</p>
          {a.email && <p className="text-muted-foreground">{a.email}</p>}
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Address',
      cell: (a) => (
        <div className="text-xs text-muted-foreground max-w-[280px]">
          <p>{a.address}</p>
          {a.postalCode && <p>{a.postalCode}</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (a) => (
        <button onClick={() => remove(a)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive">
          <Trash2 size={12} /> Delete
        </button>
      ),
    },
  ];

  const filters: FilterDef<CustomerAddress>[] = [
    {
      key: 'default',
      label: 'Default',
      accessor: (a) => (a.isDefault ? 'yes' : 'no'),
      options: [
        { value: 'yes', label: 'Default' },
        { value: 'no', label: 'Not default' },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Customer addresses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Buyer address book per merchant. Saved at checkout, reused on subsequent orders.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={14} /> New address</Button>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {!rows && !error ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card">
          <MapPin className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No addresses yet</p>
        </div>
      ) : rows && rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={columns}
          filters={filters}
          rowKey={(a) => a.id}
          searchPlaceholder="Search by name, customer, label…"
          defaultSort={{ key: 'customer', dir: 'asc' }}
          empty="No addresses match."
        />
      ) : null}

      {showForm && (
        <AddForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />
      )}
    </div>
  );
}

function AddForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [label, setLabel] = useState('Home');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setErr(null);
    try {
      const body: Record<string, unknown> = {
        customerId, label, contactName, contactPhone, address, isDefault,
      };
      if (email) body.email = email;
      if (postalCode) body.postalCode = postalCode;
      await api('/addresses', { method: 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (e) { setErr((e as Error).message); setSubmitting(false); }
  }

  return (
    <Modal title="New address" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Field label="Customer ID *" hint="Storlaunch buyer id (string).">
          <input required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input font-mono" placeholder="cust_..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Label *"><input required value={label} onChange={(e) => setLabel(e.target.value)} className="input" /></Field>
          <Field label="Contact name *"><input required value={contactName} onChange={(e) => setContactName(e.target.value)} className="input" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone *"><input required value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="input" /></Field>
          <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" /></Field>
        </div>
        <Field label="Address *"><textarea required value={address} onChange={(e) => setAddress(e.target.value)} className="input" rows={2} /></Field>
        <Field label="Postal code"><input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          <span>Default for this customer</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
