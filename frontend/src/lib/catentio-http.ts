import type { BffHttp } from '@forjio/agent-ui';
import { api, ApiError } from '@/lib/api';

/**
 * The BffHttp shim @forjio/agent-ui's createBffChatAdapters needs, over
 * fulkruma's fetch client.
 *
 * Two impedance points, both from fulkruma's BFF-proxy shape:
 *  - `api()` returns the UNWRAPPED payload, while the adapters read
 *    `resp.data ?? resp` — so each call is re-wrapped once.
 *  - `api()` stamps `content-type: application/json` on any request that
 *    has a body, which would destroy a multipart boundary. FormData
 *    therefore goes through raw fetch against the same
 *    `/api/v1/fulkruma` proxy prefix that `api()` prepends.
 */

const PROXY_PREFIX = '/api/v1/fulkruma';

export const catentioHttp: BffHttp = {
  get: (url) => api(url).then((data) => ({ data })),
  post: async (url, body, cfg) => {
    if (body instanceof FormData) {
      const res = await fetch(`${PROXY_PREFIX}${url}`, {
        method: 'POST',
        credentials: 'include',
        body,
        ...(cfg?.timeout ? { signal: AbortSignal.timeout(cfg.timeout) } : {}),
      });
      const env = (await res.json().catch(() => null)) as {
        data?: unknown;
        error?: { code: string; message: string } | null;
      } | null;
      if (!res.ok || env?.error) {
        throw new ApiError(
          env?.error?.code ?? `HTTP_${res.status}`,
          env?.error?.message ?? `Upload failed (${res.status})`,
          res.status,
        );
      }
      return { data: env?.data };
    }
    return api(url, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((data) => ({ data }));
  },
  put: (url, body) =>
    api(url, { method: 'PUT', body: JSON.stringify(body ?? {}) }).then((data) => ({ data })),
  delete: (url) => api(url, { method: 'DELETE' }).then((data) => ({ data })),
};
