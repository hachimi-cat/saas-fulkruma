import { registerFeatureFlags } from '../lib/feature-flag-registry.js';
import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import {
  getFeatureFlag,
  listFeatureFlags,
  updateFeatureFlag,
  type FeatureFlagPatch,
} from '../lib/feature-flags.js';

/*
 * GET   /api/v1/admin/feature-flags        — every flag
 * PATCH /api/v1/admin/feature-flags/:key   — toggle / set rollout / edit copy
 *
 * Mounted behind `adminGuard`. Mandatory admin-portal standard; powers
 * `FeatureFlagsPanel` from @forjio/admin-ui. See
 * forjio/documentation/2. Technical/13-Admin-Portal-Standard.md.
 *
 * There is no POST. Flags are declared in code via `ensureFeatureFlag()`
 * — a flag row nothing reads is worse than useless, because it looks like
 * a working control and does nothing.
 */

const router = Router();
const rid = (req: { requestId?: string }) => req.requestId ?? 'req_unknown';

router.get('/', async (req, res) => {
  try {
    // Registration is idempotent and lives here rather than at boot: the
    // products' index.ts files differ too much to patch one hook into
    // reliably, and the only path that needs the rows to exist is the one
    // asking for them.
    await registerFeatureFlags();
    return res.json(ok(await listFeatureFlags(), rid(req)));
  } catch (e) {
    return res
      .status(500)
      .json(err('FEATURE_FLAGS_ERROR', (e as Error).message, rid(req)));
  }
});

router.patch('/:key', async (req, res) => {
  const key = String(req.params.key);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: FeatureFlagPatch = {};

  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') {
      return res.status(400).json(err('INVALID_ENABLED', '`enabled` must be a boolean.', rid(req)));
    }
    patch.enabled = body.enabled;
  }
  if ('rollout' in body) {
    const r = body.rollout;
    // null is meaningful (all-or-nothing), so it is accepted rather than
    // treated as "field absent".
    if (r !== null && (typeof r !== 'number' || !Number.isInteger(r) || r < 0 || r > 100)) {
      return res
        .status(400)
        .json(err('INVALID_ROLLOUT', '`rollout` must be null or an integer 0-100.', rid(req)));
    }
    patch.rollout = r as number | null;
  }
  if ('allowlist' in body) {
    const a = body.allowlist;
    if (!Array.isArray(a) || a.some((v) => typeof v !== 'string' || !v.trim())) {
      return res.status(400).json(err('INVALID_LABEL', '`allowlist` must be an array of non-empty strings.', rid(req)));
    }
    // Trim and de-duplicate case-insensitively here rather than trusting
    // the client: two entries differing only in case would both evaluate
    // true and read as a duplicate the operator cannot remove.
    const seen = new Set<string>();
    patch.allowlist = (a as string[])
      .map((v) => v.trim())
      .filter((v) => {
        const k = v.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }
  if ('label' in body) {
    if (typeof body.label !== 'string' || !body.label.trim()) {
      return res.status(400).json(err('INVALID_LABEL', '`label` must be a non-empty string.', rid(req)));
    }
    patch.label = body.label.trim();
  }
  if ('description' in body) {
    if (body.description !== null && typeof body.description !== 'string') {
      return res
        .status(400)
        .json(err('INVALID_DESCRIPTION', '`description` must be a string or null.', rid(req)));
    }
    patch.description = body.description as string | null;
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json(err('EMPTY_PATCH', 'Nothing to update.', rid(req)));
  }

  try {
    // 404 before the write so a typo'd key reads as "no such flag" rather
    // than silently succeeding against nothing.
    if (!(await getFeatureFlag(key))) {
      return res.status(404).json(err('FLAG_NOT_FOUND', `No feature flag "${key}".`, rid(req)));
    }
    const updated = await updateFeatureFlag(key, patch, req.auth?.sub ?? null);
    if (!updated) {
      return res.status(404).json(err('FLAG_NOT_FOUND', `No feature flag "${key}".`, rid(req)));
    }
    return res.json(ok(updated, rid(req)));
  } catch (e) {
    return res
      .status(400)
      .json(err('FEATURE_FLAG_WRITE_FAILED', (e as Error).message, rid(req)));
  }
});

export default router;
