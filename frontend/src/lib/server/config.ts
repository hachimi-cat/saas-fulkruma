import 'server-only';

function require_env(key: string): string {
  const v = process.env[key];
  if (!v || v === 'REPLACE_ME' || v.startsWith('REPLACE_ME')) {
    throw new Error(
      `[fulkruma] required env ${key} is missing. ` +
        `Source /root/.config/forjio/fulkruma-secrets.env in dev, or set it via the deploy unit in stg/prd.`,
    );
  }
  return v;
}

function optional_env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  huudis: {
    issuer: () => optional_env('HUUDIS_ISSUER', 'https://huudis.com'),
    clientId: () => optional_env('HUUDIS_CLIENT_ID', 'fulkruma'),
    clientSecret: () => require_env('HUUDIS_CLIENT_SECRET'),
    allowedUserId: () => require_env('HUUDIS_ALLOWED_USER_ID'),
  },
  portal: {
    url: () => optional_env('FULKRUMA_PORTAL_URL', 'http://localhost:3140'),
    redirectUri: () =>
      `${optional_env('FULKRUMA_PORTAL_URL', 'http://localhost:3140')}/callback`,
  },
  session: {
    cookieSecret: () => require_env('SESSION_COOKIE_SECRET'),
    cookieName: 'fulkruma_session',
    accessTtlMs: 15 * 60 * 1000,
    refreshTtlMs: 7 * 24 * 60 * 60 * 1000,
    // SESSION_COOKIE_SECURE=false lets us run over plain HTTP on Tailnet
    // / dev-machine without browsers dropping the cookie. Defaults to
    // the standard "secure in production" rule otherwise.
    secure: () => {
      const v = process.env.SESSION_COOKIE_SECURE;
      if (v === 'true') return true;
      if (v === 'false') return false;
      return process.env.NODE_ENV === 'production';
    },
  },
  api: {
    url: () => optional_env('FULKRUMA_API_URL', 'http://localhost:4140'),
  },
};
