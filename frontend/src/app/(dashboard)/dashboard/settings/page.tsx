'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Settings as SettingsIcon, Shield, Save } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Field, ErrorBox, Loading, Button } from '@/components/dashboard/ui';
import { useAuth } from '@/lib/auth';

// ───────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────

interface Account {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  mfaEnabled?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

// ───────────────────────────────────────────────────────────────────
// Huudis API helper — same-origin proxy at /api/v1/huudis/*
// Identity lives in Huudis; Fulkruma calls these on your behalf, so
// account management stays inside the portal — no external links.
// ───────────────────────────────────────────────────────────────────

interface HuudisEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

class HuudisError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function huudis<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('/')
    ? `/api/v1/huudis${path}`
    : `/api/v1/huudis/${path}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  if (res.status === 204) return undefined as T;
  let body: HuudisEnvelope<T>;
  try {
    body = (await res.json()) as HuudisEnvelope<T>;
  } catch {
    throw new HuudisError('INVALID_RESPONSE', `HTTP ${res.status} non-JSON response`);
  }
  if (!res.ok || body.error) {
    const e = body.error ?? { code: `HTTP_${res.status}`, message: res.statusText };
    throw new HuudisError(e.code, e.message);
  }
  return body.data as T;
}

function cn(...p: (string | false | null | undefined)[]) {
  return p.filter(Boolean).join(' ');
}

// ───────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { logout } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile
  const [name, setName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Delete account
  const [deletePw, setDeletePw] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    huudis<Account>('/account')
      .then((a) => {
        setAccount(a);
        setName(a.name ?? '');
      })
      .catch((e) => setLoadError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await huudis('/account', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      });
      setProfileMsg({ kind: 'ok', text: 'Profile updated.' });
      setAccount((a) => (a ? { ...a, name: name.trim() } : a));
    } catch (err) {
      setProfileMsg({ kind: 'err', text: (err as Error)?.message ?? 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 10) {
      setPwMsg({ kind: 'err', text: 'New password must be at least 10 characters.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ kind: 'err', text: 'New passwords do not match.' });
      return;
    }
    setSavingPw(true);
    try {
      await huudis('/account/password-change', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      setPwMsg({ kind: 'ok', text: 'Password updated.' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwMsg({ kind: 'err', text: (err as Error)?.message ?? 'Failed to update password' });
    } finally {
      setSavingPw(false);
    }
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteMsg(null);
    if (deleteConfirm !== 'DELETE') {
      setDeleteMsg({ kind: 'err', text: 'Type DELETE to confirm.' });
      return;
    }
    setDeleting(true);
    try {
      await huudis('/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePw }),
      });
      setDeleteMsg({ kind: 'ok', text: 'Account deleted. Signing you out…' });
      // Identity is gone — drop the Fulkruma session and return to login.
      await logout();
    } catch (err) {
      const code = (err as HuudisError)?.code;
      const text =
        code === 'OWNS_WORKSPACES'
          ? 'You solely own one or more workspaces. Transfer ownership or delete those workspaces first, then try again.'
          : (err as Error)?.message ?? 'Failed to delete account';
      setDeleteMsg({ kind: 'err', text });
      setDeleting(false);
    }
  }

  return (
    <div className="">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        description="Manage your account identity and security. Identity is stored in Huudis; Fulkruma calls Huudis APIs on your behalf, so everything here stays in the portal."
      />

      {loading && <Loading />}

      {!loading && loadError && (
        <ErrorBox>
          Could not load your account from Huudis: {loadError}. Try signing out
          and back in.
        </ErrorBox>
      )}

      {!loading && account && (
        <div className="space-y-6">
          {/* Profile */}
          <section className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Profile</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your display name across every Forjio product.
              </p>
            </div>
            <form onSubmit={saveProfile} className="space-y-4 px-5 py-4">
              <Field label="Full name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Email" hint={account.emailVerified ? 'Verified.' : 'Not verified yet.'}>
                <input
                  type="email"
                  value={account.email}
                  disabled
                  className="input bg-secondary/50 text-muted-foreground"
                />
              </Field>
              {profileMsg && (
                <p
                  className={cn(
                    'text-xs',
                    profileMsg.kind === 'ok' ? 'text-primary' : 'text-destructive',
                  )}
                >
                  {profileMsg.text}
                </p>
              )}
              <Button
                type="submit"
                loading={savingProfile}
                disabled={!name.trim() || name.trim() === (account.name ?? '')}
              >
                <Save size={14} /> Save changes
              </Button>
            </form>
          </section>

          {/* Password */}
          <section className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">
                {account.hasPassword ? 'Change password' : 'Set password'}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {account.hasPassword
                  ? 'Use at least 10 characters.'
                  : 'You signed in via SSO. Setting a password lets you sign in with email and password too.'}
              </p>
            </div>
            <form onSubmit={changePassword} className="space-y-4 px-5 py-4">
              {account.hasPassword && (
                <Field label="Current password">
                  <input
                    type="password"
                    required
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className="input"
                  />
                </Field>
              )}
              <Field label="New password" hint="At least 10 characters.">
                <input
                  type="password"
                  required
                  minLength={10}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  type="password"
                  required
                  minLength={10}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="input"
                />
              </Field>
              {pwMsg && (
                <p
                  className={cn(
                    'text-xs',
                    pwMsg.kind === 'ok' ? 'text-primary' : 'text-destructive',
                  )}
                >
                  {pwMsg.text}
                </p>
              )}
              <Button type="submit" loading={savingPw}>
                <Save size={14} /> {account.hasPassword ? 'Update password' : 'Set password'}
              </Button>
            </form>
          </section>

          {/* Danger zone */}
          <section className="rounded-xl border border-destructive/40 bg-card">
            <div className="flex items-center gap-2 border-b border-destructive/40 px-5 py-4">
              <Shield size={16} className="text-destructive" />
              <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
            </div>
            <form onSubmit={deleteAccount} className="space-y-4 px-5 py-4">
              <p className="text-sm font-medium">Delete your account</p>
              <p className="text-xs text-muted-foreground">
                Permanently deletes your Huudis identity and removes access to
                every Forjio product. This cannot be undone. If you solely own a
                workspace, transfer or delete it first.
              </p>
              <Field label="Confirm with your password">
                <input
                  type="password"
                  required
                  value={deletePw}
                  onChange={(e) => setDeletePw(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Type DELETE to confirm">
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="input"
                  placeholder="DELETE"
                />
              </Field>
              {deleteMsg && (
                <p
                  className={cn(
                    'text-xs',
                    deleteMsg.kind === 'ok' ? 'text-primary' : 'text-destructive',
                  )}
                >
                  {deleteMsg.text}
                </p>
              )}
              <Button
                type="submit"
                variant="destructive"
                loading={deleting}
                disabled={!deletePw || deleteConfirm !== 'DELETE'}
              >
                Delete account
              </Button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
