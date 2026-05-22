'use client';

// BFF migration (F-AUTH): the thin client auth hook. The Fulkruma
// backend is the OAuth client / BFF — this hook only asks
// /api/v1/auth/me?role=<role> who (if anyone) is signed in, for UI
// gating and display. It holds NO tokens and is NOT a security
// boundary; the backend gates every request via the httpOnly session
// cookie.
//
// Fulkruma is 2-role — useAuth(role) keeps separate state per role so
// the merchant + admin portals don't clobber each other. `useAuth()`
// with no argument defaults to `merchant` (back-compat — the rest of
// the dashboard calls it with no argument).

import { useState, useEffect, useCallback } from 'react';

export type SessionRole = 'merchant' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  huudisUserId: string;
  role?: SessionRole;
}

interface AuthState {
  user: User | null;
  loading: boolean;
}

const ROLES: SessionRole[] = ['merchant', 'admin'];
const LOGIN_PATH: Record<SessionRole, string> = {
  merchant: '/login',
  admin: '/admin/login',
};
// Where logout lands per role — merchant returns to the marketing home,
// admin returns to the admin login (staff tooling has no marketing
// surface). Mirrors the per-role redirect in the shells.
const LOGOUT_PATH: Record<SessionRole, string> = {
  merchant: '/',
  admin: '/admin/login',
};

const states: Record<SessionRole, AuthState> = {
  merchant: { user: null, loading: true },
  admin: { user: null, loading: true },
};
const listeners: Record<SessionRole, Array<() => void>> = {
  merchant: [],
  admin: [],
};
const inited: Record<SessionRole, boolean> = {
  merchant: false,
  admin: false,
};

function setState(role: SessionRole, update: Partial<AuthState>) {
  states[role] = { ...states[role], ...update };
  listeners[role].forEach((l) => l());
}

async function fetchSession(role: SessionRole): Promise<User | null> {
  try {
    const res = await fetch(`/api/v1/auth/me?role=${role}`, { credentials: 'include' });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { user?: User }; user?: User } | null;
    return body?.data?.user ?? body?.user ?? null;
  } catch {
    return null;
  }
}

async function initAuth(role: SessionRole) {
  setState(role, { loading: true });
  const user = await fetchSession(role);
  setState(role, { user, loading: false });
}

/** Force a re-fetch of one role's auth state (e.g. after a workspace
 *  switch). Defaults to `merchant` for back-compat. */
export async function refreshAuth(role: SessionRole = 'merchant') {
  await initAuth(role);
}

export function useAuth(role: SessionRole = 'merchant') {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners[role].push(listener);
    if (!inited[role]) {
      inited[role] = true;
      initAuth(role);
    }
    return () => {
      const i = listeners[role].indexOf(listener);
      if (i >= 0) listeners[role].splice(i, 1);
    };
  }, [role]);

  const loginWithHuudis = useCallback(() => {
    window.location.href = `/api/v1/auth/huudis/start?role=${role}`;
  }, [role]);

  const logout = useCallback(async () => {
    try {
      await fetch(`/api/v1/auth/logout?role=${role}`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // the cookie is cleared server-side regardless
    }
    setState(role, { user: null, loading: false });
    window.location.href = LOGOUT_PATH[role];
  }, [role]);

  return {
    user: states[role].user,
    loading: states[role].loading,
    isAuthenticated: !!states[role].user,
    loginWithHuudis,
    logout,
  };
}

export { ROLES, LOGIN_PATH };
