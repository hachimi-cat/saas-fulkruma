'use client';

import { useEffect, useState } from 'react';
import { Warehouse, Plus, Archive } from 'lucide-react';
import { api, type Warehouse as Wh } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Modal, Field, ErrorBox, Loading, EmptyState, Button } from '@/components/dashboard/ui';

export default function WarehousesPage() {
  const [rows, setRows] = useState<Wh[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Wh | null>(null);

  async function reload() {
    try { setRows((await api<{ warehouses: Wh[] }>('/warehouses')).warehouses); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function archive(w: Wh) {
    if (!confirm(`Archive "${w.name}"? Stock history is preserved.`)) return;
    try { await api(`/warehouses/${w.id}`, { method: 'DELETE' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="">
      <PageHeader
        icon={Warehouse}
        title="Warehouses"
        description="Each physical or virtual location that holds stock."
        action={
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={14} /> New warehouse
          </Button>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!rows && !error && <Loading />}

      {rows && rows.length === 0 && <EmptyState>No warehouses yet — create one to start tracking stock.</EmptyState>}

      {rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">City</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-left font-medium">Default</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.city ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    {w.isDefault && (
                      <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                        default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-3">
                      <button onClick={() => { setEditing(w); setShowForm(true); }} className="text-xs font-medium text-foreground hover:underline">Edit</button>
                      <button onClick={() => archive(w)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive">
                        <Archive size={12} /> Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
