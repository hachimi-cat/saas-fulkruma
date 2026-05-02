'use client';

import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { api, type CustomerAddress } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Modal, Field, ErrorBox, Loading, EmptyState, Button } from '@/components/dashboard/ui';

export default function AddressesPage() {
  const [rows, setRows] = useState<CustomerAddress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');

  async function reload() {
    try { setRows((await api<{ addresses: CustomerAddress[] }>('/addresses')).addresses); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function remove(a: CustomerAddress) {
    if (!confirm(`Delete address "${a.label}" for ${a.contactName}?`)) return;
    try { await api(`/addresses/${a.id}`, { method: 'DELETE' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  const filtered = rows?.filter((a) =>
    !filter || a.contactName.toLowerCase().includes(filter.toLowerCase()) || a.customerId.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        icon={MapPin}
        title="Customer addresses"
        description="Buyer address book per merchant. Saved at checkout, reused on subsequent orders."
        action={<Button onClick={() => setShowForm(true)}><Plus size={14} /> New address</Button>}
      />

      <div className="mb-4">
        <input
          type="search"
          placeholder="Filter by name or customer ID…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input max-w-md"
        />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}
      {filtered && filtered.length === 0 && <EmptyState>No addresses{filter ? ' match.' : ' yet.'}</EmptyState>}

      {filtered && filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Label</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Address</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.customerId}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{a.label}</span>
                    {a.isDefault && (
                      <span className="ml-2 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                        default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-medium">{a.contactName}</p>
                    <p className="text-muted-foreground">{a.contactPhone}</p>
                    {a.email && <p className="text-muted-foreground">{a.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[280px]">
                    <p>{a.address}</p>
                    {a.postalCode && <p>{a.postalCode}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(a)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive">
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
