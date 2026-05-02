'use client';

import { useEffect, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug?: string;
  role?: 'owner' | 'admin' | 'member';
  isActive?: boolean;
  isForjioInternal?: boolean;
  joinedAt?: string;
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/huudis/account/workspaces', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((body) => {
        const list: Workspace[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
        setWorkspaces(list);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Building2 size={18} strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every Huudis workspace you belong to. Switch between them from the sidebar.
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load workspaces: {error}
        </div>
      )}

      {!workspaces && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      )}

      {workspaces && workspaces.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          No workspaces yet.
        </div>
      )}

      {workspaces && workspaces.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Slug</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => (
                <tr key={w.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground text-xs font-bold uppercase">
                        {w.name.slice(0, 1)}
                      </span>
                      <span className="font-medium">{w.name}</span>
                      {w.isForjioInternal && (
                        <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                          forjio
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.slug ?? '—'}</td>
                  <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{w.role ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {w.joinedAt ? new Date(w.joinedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Workspace creation, invites, and member management live in{' '}
        <a className="underline hover:text-foreground" href="https://huudis.com/dashboard">
          Huudis
        </a>{' '}
        — the source of truth for identity across the Forjio family.
      </p>
    </div>
  );
}
