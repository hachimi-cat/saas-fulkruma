'use client';

import { AuthForm, type SocialProviders } from '@forjio/auth-ui';
import type { SessionRole } from '@/lib/auth';

interface Props {
  mode: 'login' | 'signup';
  role: SessionRole;
  /** Social providers resolved server-side by the host page (via
   *  `fetchSocialProviders`). Passing them avoids a client-side
   *  provider fetch — no flash of disabled buttons. */
  providers?: SocialProviders | null;
}

const ROLE_LANDING: Record<
  SessionRole,
  { dashboard: string; loginPath: string; signupPath: string; forgotPath: string }
> = {
  merchant: {
    dashboard: '/dashboard',
    loginPath: '/login',
    signupPath: '/signup',
    forgotPath: '/forgot-password',
  },
  // The admin portal is login-only — no public registration. signupPath
  // points back at the login page; admins are seeded via Fulkruma-
  // workspace membership in Huudis, not self-serve.
  admin: {
    dashboard: '/admin/dashboard',
    loginPath: '/admin/login',
    signupPath: '/admin/login',
    forgotPath: '/admin/forgot-password',
  },
};

/**
 * Role-aware auth form. A thin wrapper over `@forjio/auth-ui`'s
 * `AuthForm` — it owns only the role → props mapping. The form
 * internals (inputs, social buttons, MFA hand-off) live in auth-ui.
 *
 * Fulkruma's auth BFF expects a `role` discriminator in the
 * login/signup body, passed through `extraBody`. Auth endpoints match
 * the package defaults (`@forjio/sdk/auth-server` `createAuthRouter`),
 * so no `endpoints` override is needed.
 */
export function RoleAuthForm({ mode, role, providers }: Props) {
  const conf = ROLE_LANDING[role];

  return (
    <AuthForm
      mode={mode}
      brand="Fulkruma"
      providers={providers}
      loginHref={conf.loginPath}
      signupHref={conf.signupPath}
      defaultReturnTo={conf.dashboard}
      forgotPasswordHref={conf.forgotPath}
      extraBody={{ role }}
      socialParams={{ role }}
    />
  );
}
