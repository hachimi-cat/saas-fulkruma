'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  Building2,
  Plus,
  Crown,
  Shield,
  Users,
  Loader2,
  Trash2,
  Mail,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Modal,
  Field,
  ErrorBox,
  Loading,
  EmptyState,
  Button,
} from '@/components/dashboard/ui';

// ───────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  role?: 'owner' | 'admin' | 'member';
  isActive?: boolean;
  isForjioInternal?: boolean;
}

interface Member {
  userId: string;
  email: string;
  name: string | null;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  isYou?: boolean;
}

interface Invite {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  invitedAt: string;
  expiresAt: string;
}

// ───────────────────────────────────────────────────────────────────
// Cookie helpers (active workspace cookie consumed by sidebar + proxy)
// ───────────────────────────────────────────────────────────────────

const ACTIVE_WS_COOKIE = 'fulkruma_active_workspace';

function readActiveCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((r) => r.startsWith(`${ACTIVE_WS_COOKIE}=`));
  return match
    ? decodeURIComponent(match.split('=').slice(1).join('='))
    : null;
}

function writeActiveCookie(id: string) {
  if (typeof document === 'undefined') return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ACTIVE_WS_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax${secure}`;
}

// ───────────────────────────────────────────────────────────────────
// Huudis API helper — same-origin proxy at /api/v1/huudis/*
// ───────────────────────────────────────────────────────────────────

interface HuudisEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

async function huudis<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith('/')
    ? `/api/v1/huudis${path}`
    : `/api/v1/huudis/${path}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  // 204 has no body
  if (res.status === 204) return undefined as T;
  let body: HuudisEnvelope<T>;
  try {
    body = (await res.json()) as HuudisEnvelope<T>;
  } catch {
    throw new Error(`HTTP ${res.status} non-JSON response`);
  }
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  }
  return body.data as T;
}

function cn(...p: (string | false | null | undefined)[]) {
  return p.filter(Boolean).join(' ');
}

// ───────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState<Workspace | null>(null);

  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameMsg, setRenameMsg] = useState('');

  async function reload() {
    try {
      const list = await huudis<Workspace[]>('/account/workspaces');
      setWorkspaces(list);
      const cookieActive = readActiveCookie();
      const fromCookie = cookieActive
        ? list.find((w) => w.id === cookieActive)
        : null;
      const active =
        fromCookie ??
        list.find((w) => w.isActive) ??
        list.find((w) => w.role === 'owner') ??
        list[0];
      if (active) {
        setActiveId(active.id);
        setRenameName(active.name);
        if (!cookieActive) writeActiveCookie(active.id);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSwitch(id: string) {
    // Tell Huudis to update the active account on the session, then update
    // our local cookie + reload so every server component re-renders under
    // the new workspace scope (sidebar selector, dashboard pages, etc.).
    try {
      await huudis(`/account/workspaces/${id}/switch`, { method: 'POST' });
    } catch {
      // Non-fatal: switch endpoint is a no-op for bearer-token sessions
      // anyway — the cookie + reload still scope subsequent calls.
    }
    writeActiveCookie(id);
    window.location.reload();
  }

  const active = workspaces?.find((w) => w.id === activeId) ?? null;
  const isOwnerOrAdmin = active?.role === 'owner' || active?.role === 'admin';

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    if (!active || !renameName.trim() || renameName === active.name) return;
    setRenaming(true);
    setRenameMsg('');
    try {
      await huudis(`/account/workspaces/${active.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameName.trim() }),
      });
      setRenameMsg('Workspace renamed');
      setWorkspaces((prev) =>
        prev
          ? prev.map((w) =>
              w.id === active.id ? { ...w, name: renameName.trim() } : w,
            )
          : prev,
      );
    } catch (err) {
      setRenameMsg((err as Error)?.message ?? 'Failed to rename');
    } finally {
      setRenaming(false);
    }
  }

  return (
    <div className="">
      <PageHeader
        title="Workspaces"
        description="Manage your workspaces and team members. Identity is stored in Huudis; Fulkruma calls Huudis APIs on your behalf."
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New workspace
          </Button>
        }
      />

      {error && <ErrorBox>Failed to load workspaces: {error}</ErrorBox>}
      {!workspaces && !error && <Loading />}

      {workspaces && workspaces.length === 0 && (
        <EmptyState>
          No workspaces visible. Huudis may not have shared any with this login
          yet.
        </EmptyState>
      )}

      {workspaces && workspaces.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className={cn(
                  'flex items-center justify-between px-5 py-4',
                  ws.id === activeId && 'bg-primary/5',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground text-sm font-bold uppercase">
                    {ws.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {ws.name}
                      {ws.id === activeId && (
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                          Active
                        </span>
                      )}
                      {ws.isForjioInternal && (
                        <span className="ml-2 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                          forjio
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{ws.slug}</span>
                      {ws.plan ? ` · ${ws.plan}` : ''}
                      {ws.role && (
                        <span className="ml-1 inline-flex items-center gap-1">
                          ·{' '}
                          {ws.role === 'owner' && (
                            <Crown size={10} className="text-amber-500" />
                          )}
                          {ws.role === 'admin' && (
                            <Shield size={10} className="text-primary" />
                          )}
                          <span className="capitalize">{ws.role}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowMembers(ws)}
                  >
                    <Users size={13} /> Members
                  </Button>
                  {ws.id !== activeId && (
                    <Button
                      variant="secondary"
                      onClick={() => handleSwitch(ws.id)}
                    >
                      Switch
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rename active workspace */}
      {isOwnerOrAdmin && active && (
        <div className="mt-6 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Workspace settings</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Rename your active workspace
            </p>
          </div>
          <form onSubmit={handleRename} className="px-5 py-4">
            <Field label="Workspace name">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  className="input flex-1"
                />
                <Button
                  type="submit"
                  loading={renaming}
                  disabled={
                    !renameName.trim() || renameName === active.name
                  }
                >
                  Rename
                </Button>
              </div>
            </Field>
            {renameMsg && (
              <p
                className={cn(
                  'mt-2 text-xs',
                  renameMsg.includes('renamed')
                    ? 'text-primary'
                    : 'text-destructive',
                )}
              >
                {renameMsg}
              </p>
            )}
          </form>
        </div>
      )}

      {/* Create workspace modal */}
      {showCreate && (
        <CreateWorkspace
          onClose={() => setShowCreate(false)}
          onCreated={(ws) => {
            setShowCreate(false);
            setWorkspaces((prev) => (prev ? [...prev, ws] : [ws]));
          }}
        />
      )}

      {/* Members modal */}
      {showMembers && (
        <MembersModal
          workspace={showMembers}
          isActive={showMembers.id === activeId}
          onClose={() => setShowMembers(null)}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// CreateWorkspace
// ───────────────────────────────────────────────────────────────────

function CreateWorkspace({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (ws: Workspace) => void;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      const ws = await huudis<Workspace>('/account/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      onCreated(ws);
    } catch (e) {
      setErr((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New workspace" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Field
          label="Name *"
          hint="A team, a brand, or a separate ledger — workspaces fully isolate data."
        >
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────────────
// MembersModal — list members + invite + change role + remove
// ───────────────────────────────────────────────────────────────────

function MembersModal({
  workspace,
  isActive,
  onClose,
}: {
  workspace: Workspace;
  isActive: boolean;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  async function reload() {
    setError(null);
    try {
      // /iam/users + /iam/invites operate on the actor's currently-active
      // workspace. Ask the user to switch first if they opened the modal
      // for a non-active workspace.
      if (!isActive) {
        setMembers([]);
        setInvites([]);
        return;
      }
      const [users, pending] = await Promise.all([
        huudis<Array<{
          id: string;
          email: string;
          name: string | null;
          role: 'owner' | 'admin' | 'member';
          joinedAt: string;
          isYou?: boolean;
        }>>('/iam/users'),
        huudis<Invite[]>('/iam/invites').catch(() => [] as Invite[]),
      ]);
      const list: Member[] = users.map((u) => ({
        userId: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        joinedAt: u.joinedAt,
        isYou: u.isYou,
      }));
      setMembers(list);
      setInvites(pending);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id, isActive]);

  const isOwnerOrAdmin =
    workspace.role === 'owner' || workspace.role === 'admin';

  async function changeRole(m: Member, role: 'owner' | 'admin' | 'member') {
    try {
      await huudis(`/iam/users/${m.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setMembers((prev) =>
        prev ? prev.map((x) => (x.userId === m.userId ? { ...x, role } : x)) : prev,
      );
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function removeMember(m: Member) {
    if (
      !confirm(
        `Remove ${m.name ?? m.email} from ${workspace.name}? They will lose access immediately.`,
      )
    )
      return;
    try {
      await huudis(`/iam/users/${m.userId}`, { method: 'DELETE' });
      setMembers((prev) =>
        prev ? prev.filter((x) => x.userId !== m.userId) : prev,
      );
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function cancelInvite(inv: Invite) {
    if (!confirm(`Cancel the pending invite for ${inv.email}?`)) return;
    try {
      await huudis(`/iam/invites/${inv.id}`, { method: 'DELETE' });
      setInvites((prev) =>
        prev ? prev.filter((x) => x.id !== inv.id) : prev,
      );
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <Modal title={`Members · ${workspace.name}`} onClose={onClose} wide>
      {!isActive && (
        <div className="mb-4 rounded-md border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
          Switch to this workspace first to view or edit its members. Member
          management always operates on your active workspace.
        </div>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}
      {isActive && !members && !error && <Loading />}

      {isActive && members && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {members.length} {members.length === 1 ? 'member' : 'members'}
              {invites && invites.length > 0
                ? ` · ${invites.length} pending invite${invites.length === 1 ? '' : 's'}`
                : ''}
            </p>
            {isOwnerOrAdmin && (
              <Button onClick={() => setShowInvite(true)}>
                <Mail size={13} /> Invite
              </Button>
            )}
          </div>

          {members.length === 0 ? (
            <EmptyState>No members listed.</EmptyState>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="divide-y divide-border">
                {members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium uppercase">
                        {(m.name ?? m.email).charAt(0)}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {m.name ?? m.email}
                          {m.isYou && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwnerOrAdmin && !m.isYou ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            changeRole(m, v as 'owner' | 'admin' | 'member')
                          }
                        >
                          <SelectTrigger className="h-7 w-auto gap-1.5 px-2 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                            m.role === 'owner' &&
                              'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                            m.role === 'admin' && 'bg-primary/10 text-primary',
                            m.role === 'member' &&
                              'bg-secondary text-muted-foreground',
                          )}
                        >
                          {m.role === 'owner' && <Crown size={10} />}
                          {m.role === 'admin' && <Shield size={10} />}
                          <span className="capitalize">{m.role}</span>
                        </span>
                      )}
                      {isOwnerOrAdmin && !m.isYou && (
                        <button
                          onClick={() => removeMember(m)}
                          aria-label={`Remove ${m.email}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invites && invites.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pending invites
              </h3>
              <div className="overflow-hidden rounded-xl border border-dashed border-border">
                <div className="divide-y divide-border">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs">
                          <Mail size={12} />
                        </span>
                        <div>
                          <p className="text-sm font-medium">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="capitalize">{inv.role}</span> ·
                            invited{' '}
                            {new Date(inv.invitedAt).toLocaleDateString()} ·
                            expires{' '}
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {isOwnerOrAdmin && (
                        <button
                          onClick={() => cancelInvite(inv)}
                          aria-label={`Cancel invite for ${inv.email}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showInvite && (
        <InviteForm
          onClose={() => setShowInvite(false)}
          onInvited={(inv) => {
            setShowInvite(false);
            setInvites((prev) => (prev ? [inv, ...prev] : [inv]));
          }}
        />
      )}
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────────────
// InviteForm
// ───────────────────────────────────────────────────────────────────

function InviteForm({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (inv: Invite) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      const inv = await huudis<Invite>('/iam/invites', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
      onInvited(inv);
    } catch (e) {
      setErr((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Invite a teammate" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <Field
          label="Email *"
          hint="They'll receive a Huudis invite link valid for 7 days."
        >
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Role *">
          <Select value={role} onValueChange={(v) => setRole(v as 'owner' | 'admin' | 'member')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member — read &amp; act on assigned data</SelectItem>
              <SelectItem value="admin">Admin — manage members + settings</SelectItem>
              <SelectItem value="owner">Owner — full control</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Send invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
