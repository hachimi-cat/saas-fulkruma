'use client';

import { useEffect, useState } from 'react';

export type HuudisProviders = {
  google?: boolean;
  apple?: boolean;
  facebook?: boolean;
};

type EnvelopeResponse = { data?: HuudisProviders } | null;

/**
 * Queries Huudis for the set of enabled social auth providers.
 *
 * Returns `providers = null` on fetch errors so the caller can fail
 * open (treat unknown providers as enabled). The endpoint is public
 * and CORS-safe — we send `credentials: 'omit'` so it never carries
 * the portal session cookie.
 */
export function useHuudisProviders(): {
  providers: HuudisProviders | null;
  loading: boolean;
} {
  const [providers, setProviders] = useState<HuudisProviders | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const huudisUrl =
      process.env.NEXT_PUBLIC_HUUDIS_ISSUER ?? 'https://huudis.com';
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${huudisUrl}/api/v1/auth/providers`, {
          credentials: 'omit',
        });
        if (!res.ok) throw new Error(`providers fetch failed (${res.status})`);
        const payload = (await res.json()) as EnvelopeResponse;
        if (!cancelled) setProviders(payload?.data ?? null);
      } catch {
        if (!cancelled) setProviders(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { providers, loading };
}
