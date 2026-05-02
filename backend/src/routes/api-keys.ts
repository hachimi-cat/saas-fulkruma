import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.enum(['read', 'write', 'admin'])).min(1).default(['read', 'write']),
});

function newKeyId(): string {
  return `AKIAFULK${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}
function newSecret(): string {
  return `fulksk_${crypto.randomBytes(32).toString('base64url')}`;
}
function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function preview(secret: string): string {
  return `${secret.slice(0, 8)}…${secret.slice(-4)}`;
}

router.get('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const rows = await prisma.apiKey.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, keyId: true, secretPreview: true, scopes: true,
      createdAt: true, lastUsedAt: true, revokedAt: true, createdBy: true,
    },
  });
  res.json(ok({ apiKeys: rows }, req.requestId ?? 'req_unknown'));
});

router.post('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const keyId = newKeyId();
  const secret = newSecret();
  const created = await prisma.apiKey.create({
    data: {
      accountId,
      name: parsed.data.name,
      keyId,
      secretHash: sha256Hex(secret),
      secretPreview: preview(secret),
      scopes: parsed.data.scopes,
      createdBy: userId ?? null,
    },
  });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'api_key.created',
    targetType: 'ApiKey', targetId: created.id,
    after: { name: created.name, keyId, scopes: parsed.data.scopes },
  });
  // Return the secret ONCE — never readable again.
  res.status(201).json(ok({
    apiKey: {
      id: created.id, name: created.name, keyId, scopes: parsed.data.scopes,
      createdAt: created.createdAt,
    },
    secret,
  }, req.requestId ?? 'req_unknown'));
});

router.post('/:id/revoke', async (req, res) => {
  const accountId = req.auth?.accountId;
  const userId = req.auth?.sub;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const key = await prisma.apiKey.findFirst({ where: { id: req.params.id, accountId } });
  if (!key) return res.status(404).json(err('NOT_FOUND', 'api key not found', req.requestId ?? 'req_unknown'));
  if (key.revokedAt) return res.status(409).json(err('ALREADY_REVOKED', 'already revoked', req.requestId ?? 'req_unknown'));
  const updated = await prisma.apiKey.update({
    where: { id: key.id },
    data: { revokedAt: new Date() },
  });
  await writeAuditLog(prisma, {
    accountId, actorType: 'user', actorId: userId ?? null,
    action: 'api_key.revoked',
    targetType: 'ApiKey', targetId: key.id,
    before: { revokedAt: null }, after: { revokedAt: updated.revokedAt },
  });
  res.json(ok({ apiKey: { id: updated.id, revokedAt: updated.revokedAt } }, req.requestId ?? 'req_unknown'));
});

export default router;
