'use client';

// BFF migration (F-AUTH): the thin client auth hook. The Fulkruma
// backend is the OAuth client / BFF — this hook only asks
// /api/v1/auth/me who (if anyone) is signed in, for UI gating and
// display. It holds NO tokens and is NOT a security boundary; the
// backend gates every request via the httpOnly session cookie.
//
// Module-level state + a listener set = one shared auth state across
// every useAuth() consumer, fetched once. Ported from saas-catentio.

import { useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  huudisUserId: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
}

let authState: AuthState = { user: null, loading: true };
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((l) => l());
}

function setAuthState(update: Partial<AuthState>) {
  authState = { ...authState, ...update };
  notify();
}

async function fetchSession(): Promise<User | null> {
  try {
    const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const body = (await res.json()) as
      | { data?: { user?: User }; user?: User }
      | null;
    return body?.data?.user ?? body?.user ?? null;
  } catch {
    return null;
  }
}

async function initAuth() {
  setAuthState({ loading: true });
  const user = await fetchSession();
  setAuthState({ user, loading: false });
}

/** Force a re-fetch of the auth state (e.g. after a workspace switch). */
export async function refreshAuth() {
  await initAuth();
}

export function useAuth() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.push(listener);
    if (authState.loading && !authState.user) {
      initAuth();
    }
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const loginWithHuudis = useCallback(() => {
    window.location.href = '/api/v1/auth/huudis/start';
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // the cookie is cleared server-side regardless
    }
    setAuthState({ user: null, loading: false });
    window.location.href = '/login';
  }, []);

  return {
    user: authState.user,
    loading: authState.loading,
    isAuthenticated: !!authState.user,
    loginWithHuudis,
    logout,
  };
}
