import type { Request } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { createCatentioRouter, type CatentioEmbedUser } from '@forjio/catentio-embed';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';
import { catentioPilotEnabled } from '../lib/feature-flag-registry.js';
import {
  FULKRUMA_DELEGATION_PREFIX,
  FULKRUMA_PROFILE,
  type FulkrumaLimits,
} from '../lib/catentio-profile.js';

/**
 * The catentio BFF — fulkruma's consumption of @forjio/catentio-embed.
 * Everything mechanical (gates, buckets, credit pre-flight, delegation
 * minting, sanitizers, attachment/media serving) lives in the package;
 * this file is the product adapter.
 *
 * Fulkruma does not use the family's lib/http helpers — it composes the
 * SDK's `ok()`/`err()` inline with a requestId, so the envelope adapter
 * does the same rather than inventing a second shape.
 */

function resolveUser(req: Request): CatentioEmbedUser | null {
  const auth = req.auth as
    | { sub?: string; accountId?: string; email?: string; name?: string }
    | undefined;
  // API-key auth stamps `api_key:` subs — the assistant is per-user (the
  // flag allowlist holds usr_… ids) and acts as a person, never as a
  // workspace credential.
  if (!auth?.sub || !auth.accountId || auth.sub.startsWith('api_key:')) return null;
  return {
    sub: auth.sub,
    email: auth.email ?? '',
    name: auth.name ?? '',
    workspaceId: auth.accountId,
    plan: 'FREE',
  };
}

const embed = createCatentioRouter<FulkrumaLimits>({
  product: 'fulkruma',
  profile: FULKRUMA_PROFILE,
  knownApiBases: ['https://fulkruma.forjio.com', 'https://staging-fulkruma.forjio.com'],
  authenticate: requireAuth,
  getUser: resolveUser,
  flagEnabled: (u) => catentioPilotEnabled(u.sub, u.email),
  envelope: {
    ok: (res, data) => res.json(ok(data, (res as any).req?.requestId ?? 'req_unknown')),
    err: (res, e) =>
      res.status(e.status).json(err(e.code, e.message, (res as any).req?.requestId ?? 'req_unknown')),
  },
  settings: {
    async getAutoApply(accountId) {
      const row = await prisma.assistantSettings.findUnique({ where: { accountId } });
      return row?.autoApply !== false;
    },
    async setAutoApply(accountId, autoApply) {
      await prisma.assistantSettings.upsert({
        where: { accountId },
        create: { accountId, autoApply },
        update: { autoApply },
      });
    },
  },
  planLimits: () => ({ plan: 'free' }),
  // Fulkruma keeps no local roles (membership is Huudis-side); any
  // signed-in member of the workspace may flip the assistant setting.
  canWriteSettings: () => true,
  delegationPrefix: FULKRUMA_DELEGATION_PREFIX,
});

export const clearCatentioGateState = embed.clearGateState;
export default embed.router;
