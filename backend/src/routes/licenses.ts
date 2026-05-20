import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { buildEvent } from '../lib/events.js';

const router = Router();

const issueSchema = z.object({
  productId: z.string().min(1),
  customerId: z.string().min(1),
  maxActivations: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  externalSource: z.string().min(1).max(50).optional(),
  externalRef: z.string().min(1).max(255).optional(),
  // Optional caller-supplied key. Lets an upstream product be the
  // source of truth for the key (e.g. Storlaunch's merchant key pool)
  // and have Fulkruma mirror it, so the buyer's key and Fulkruma's
  // License Keys menu agree. Omitted → Fulkruma generates one.
  key: z.string().min(8).max(120).optional(),
});

const activateSchema = z.object({
  key: z.string().min(8),
  instanceId: z.string().min(1),
});

const deactivateSchema = z.object({
  key: z.string().min(8),
  instanceId: z.string().min(1),
});

const validateSchema = z.object({
  key: z.string().min(1),
  productId: z.string().optional(),
});

function newLicenseKey() {
  // 5 × 5 base32 groups: e.g. 7K3PH-9X2RM-...
  const raw = crypto.randomBytes(15).toString('base64')
    .replace(/[+/=]/g, '')
    .toUpperCase()
    .slice(0, 25);
  return raw.match(/.{1,5}/g)!.join('-');
}

// Public unauthenticated endpoints — buyers' software calls these with
// just the license key. Mount BEFORE requireAuth.
//
// GET /licenses/validate?key=<key>&productId=<optional>
//   Returns `{ valid, status, productId, productName, activations,
//             maxActivations, expiresAt }`. Never errors on bad keys —
//   just returns valid:false. Used by license-protected software to
//   check whether a key is still good.
router.get('/validate', async (req, res) => {
  const parsed = validateSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const where: Record<string, unknown> = { key: parsed.data.key };
  if (parsed.data.productId) where.productId = parsed.data.productId;
  const license = await prisma.license.findFirst({ where });
  if (!license || license.status === 'revoked') {
    return res.json(ok({
      valid: false, key: parsed.data.key,
      status: license?.status ?? null,
      productId: null, activations: null, maxActivations: null, expiresAt: null,
    }, req.requestId ?? 'req_unknown'));
  }
  const expired = license.expiresAt && license.expiresAt < new Date();
  return res.json(ok({
    valid: !expired,
    key: license.key,
    status: expired ? 'expired' : license.status,
    productId: license.productId,
    activations: license.activations,
    maxActivations: license.maxActivations,
    expiresAt: license.expiresAt,
  }, req.requestId ?? 'req_unknown'));
});

// POST /licenses/deactivate — release a previously-activated instance.
// Buyers' apps call this when uninstalling. Idempotent on repeat calls.
router.post('/deactivate', async (req, res) => {
  const parsed = deactivateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const license = await prisma.license.findUnique({ where: { key: parsed.data.key } });
  if (!license) {
    return res.status(404).json(err('NOT_FOUND', 'license not found', req.requestId ?? 'req_unknown'));
  }
  const result = await prisma.$transaction(async (tx) => {
    const activation = await tx.licenseActivation.findUnique({
      where: { licenseId_instanceId: { licenseId: license.id, instanceId: parsed.data.instanceId } },
    });
    if (!activation || activation.deactivatedAt) {
      return { deactivated: true, alreadyDeactivated: true, activations: license.activations };
    }
    await tx.licenseActivation.update({
      where: { licenseId_instanceId: { licenseId: license.id, instanceId: parsed.data.instanceId } },
      data: { deactivatedAt: new Date() },
    });
    const updated = await tx.license.update({
      where: { id: license.id },
      data: { activations: { decrement: 1 } },
    });
    return { deactivated: true, alreadyDeactivated: false, activations: Math.max(0, updated.activations) };
  });
  res.json(ok(result, req.requestId ?? 'req_unknown'));
});

// /v1/licenses/activate is unauthenticated — buyers' apps call this
// with the license key directly. Mount BEFORE requireAuth.
router.post('/activate', async (req, res) => {
  const parsed = activateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  const license = await prisma.license.findUnique({ where: { key: parsed.data.key } });
  if (!license || license.status !== 'active') {
    return res.status(404).json(err('INVALID_KEY', 'license not found or revoked', req.requestId ?? 'req_unknown'));
  }
  if (license.expiresAt && license.expiresAt < new Date()) {
    return res.status(403).json(err('EXPIRED', 'license expired', req.requestId ?? 'req_unknown'));
  }
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.licenseActivation.findUnique({
      where: { licenseId_instanceId: { licenseId: license.id, instanceId: parsed.data.instanceId } },
    });
    if (existing) {
      return { license, activation: existing, alreadyActive: true };
    }
    const active = await tx.licenseActivation.count({
      where: { licenseId: license.id, deactivatedAt: null },
    });
    if (active >= license.maxActivations) {
      throw new Error('MAX_ACTIVATIONS');
    }
    const activation = await tx.licenseActivation.create({
      data: { licenseId: license.id, instanceId: parsed.data.instanceId },
    });
    await tx.license.update({
      where: { id: license.id },
      data: { activations: { increment: 1 } },
    });
    return { license, activation, alreadyActive: false };
  }).catch((e) => {
    if (e instanceof Error && e.message === 'MAX_ACTIVATIONS') {
      throw e;
    }
    throw e;
  });
  res.json(ok(result, req.requestId ?? 'req_unknown'));
});

// All other license routes require the merchant's bearer.
router.use(requireAuth);

router.get('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const rows = await prisma.license.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(ok({ licenses: rows }, req.requestId ?? 'req_unknown'));
});

router.post('/', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(err('VALIDATION', parsed.error.message, req.requestId ?? 'req_unknown'));
  }
  // Caller-supplied key: be idempotent on webhook retries (return the
  // existing license) and refuse to clobber another account's key
  // rather than collide on the unique `key` column.
  if (parsed.data.key) {
    const existing = await prisma.license.findUnique({ where: { key: parsed.data.key } });
    if (existing) {
      if (existing.accountId === accountId) {
        return res.status(200).json(ok({ license: existing }, req.requestId ?? 'req_unknown'));
      }
      return res.status(409).json(err('KEY_TAKEN', 'license key already in use', req.requestId ?? 'req_unknown'));
    }
  }
  const license = await prisma.$transaction(async (tx) => {
    const created = await tx.license.create({
      data: {
        accountId,
        productId: parsed.data.productId,
        customerId: parsed.data.customerId,
        key: parsed.data.key ?? newLicenseKey(),
        maxActivations: parsed.data.maxActivations ?? 1,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        externalSource: parsed.data.externalSource ?? null,
        externalRef: parsed.data.externalRef ?? null,
      },
    });
    await tx.outboxEvent.create({
      data: buildEvent({
        type: 'fulkruma.license.issued.v1',
        accountId,
        data: {
          licenseId: created.id,
          productId: created.productId,
          customerId: created.customerId,
        },
      }),
    });
    return created;
  });
  res.status(201).json(ok({ license }, req.requestId ?? 'req_unknown'));
});

router.post('/:id/revoke', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));
  const license = await prisma.license.findFirst({ where: { id: req.params.id, accountId } });
  if (!license) return res.status(404).json(err('NOT_FOUND', 'license not found', req.requestId ?? 'req_unknown'));
  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.license.update({
      where: { id: license.id },
      data: { status: 'revoked' },
    });
    await tx.outboxEvent.create({
      data: buildEvent({
        type: 'fulkruma.license.revoked.v1',
        accountId,
        data: { licenseId: r.id, productId: r.productId, customerId: r.customerId },
      }),
    });
    return r;
  });
  res.json(ok({ license: updated }, req.requestId ?? 'req_unknown'));
});

export default router;
