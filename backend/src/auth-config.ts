import {
  createHuudisOidc,
  createSessionCodec,
  type AuthServerConfig,
} from '@forjio/sdk/auth-server';

// BFF auth — Fulkruma's binding of the shared @forjio/sdk/auth-server
// kit. Single-role product: the Huudis sub IS the accountId (see
// middleware/auth.ts). Single-user gate via HUUDIS_ALLOWED_USER_ID(S).

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
  },
  // Single-user gate — empty allowlist ⇒ open (multi-tenant).
  gate: ALLOWED_USER_IDS.length === 0 ? undefined : (sub) => ALLOWED_USER_IDS.includes(sub),
  stateCookie: 'fulkruma_oidc_state',
  stateSecret:
    process.env.OIDC_SIGNING_SECRET ?? CLIENT_SECRET ?? 'dev-only-fallback-oidc-secret',
  roleHeader: 'x-fulkruma-role',
  // Forward `?provider=` as an OIDC idp_hint so "Continue with Google /
  // Apple" skips the Huudis login page and lands straight on the social
  // provider.
  allowIdpHint: true,
};
