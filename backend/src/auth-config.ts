import {
  createHuudisOidc,
  createSessionCodec,
  type AuthServerConfig,
} from '@forjio/sdk/auth-server';

// BFF auth — Fulkruma's binding of the shared @forjio/sdk/auth-server
// kit. Two roles:
//
//   - merchant: the main product portal. The Huudis sub IS the
//     accountId (see middleware/auth.ts). Single-user gate via
//     HUUDIS_ALLOWED_USER_ID(S); empty allowlist ⇒ open.
//   - admin: the in-fulkruma staff console (partner-billing review).
//     The accountId is `adm_`-prefixed. Restricted to owner/admin
//     members of Fulkruma's own Huudis workspace — Huudis emits the
//     user's workspace role as the `workspace_role` claim, so admins
//     are managed by Fulkruma-workspace membership, not an allowlist.

const ALLOWED_USER_IDS = [
  process.env.HUUDIS_ALLOWED_USER_IDS ?? '',
  process.env.HUUDIS_ALLOWED_USER_ID ?? '',
]
  .join(',')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('REPLACE_ME'));

const CLIENT_SECRET = process.env.HUUDIS_CLIENT_SECRET ?? '';

export const authConfig: AuthServerConfig = {
  oidc: createHuudisOidc({
    issuer: process.env.HUUDIS_ISSUER ?? 'https://huudis.com',
    clientId: process.env.HUUDIS_CLIENT_ID ?? 'fulkruma',
    clientSecret: CLIENT_SECRET,
    scope: 'openid profile email fulkruma:admin',
  }),
  codec: createSessionCodec({
    secret: process.env.SESSION_SIGNING_SECRET ?? CLIENT_SECRET ?? 'dev-only-fallback-session-secret',
  }),
  roles: {
    merchant: { cookie: 'fulkruma_session', accountId: (sub) => sub, returnTo: '/dashboard' },
    admin: {
      cookie: 'fulkruma_admin_session',
      accountId: (sub) => `adm_${sub}`,
      returnTo: '/admin/dashboard',
      loginPath: '/admin/login',
    },
  },
  // Sign-in gate. The `merchant` role keeps the single-user allowlist
  // (empty allowlist ⇒ open / multi-tenant). The `admin` role is gated
  // ONLY on Fulkruma-workspace membership: Huudis emits `workspace_role`
  // for the user in the fulkruma OIDC client's workspace; a non
  // owner/admin member can never mint an `admin` session.
  gate: (sub, role, ctx) => {
    if (role === 'admin') {
      return (
        ctx?.claims?.workspace_role === 'owner' ||
        ctx?.claims?.workspace_role === 'admin'
      );
    }
    // merchant
    return ALLOWED_USER_IDS.length === 0 || ALLOWED_USER_IDS.includes(sub);
  },
  stateCookie: 'fulkruma_oidc_state',
  stateSecret:
    process.env.OIDC_SIGNING_SECRET ?? CLIENT_SECRET ?? 'dev-only-fallback-oidc-secret',
  roleHeader: 'x-fulkruma-role',
  // Forward `?provider=` as an OIDC idp_hint so "Continue with Google /
  // Apple" skips the Huudis login page and lands straight on the social
  // provider.
  allowIdpHint: true,
};
