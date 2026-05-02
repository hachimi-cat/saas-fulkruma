/**
 * Inbound webhook receiver for Storlaunch events.
 *
 * Storlaunch fans out product/variant changes via its outbox so fulkruma
 * can keep a catalogue mirror with `externalSource='storlaunch'` and
 * `externalRef=<storlaunch productId>`. Handlers are idempotent —
 * duplicate event ids are recorded as processed and exit cleanly.
 *
 * Mounted BEFORE `express.json()` so the raw body survives for HMAC
 * verification. Header: `Storlaunch-Signature: t=<unix>,v1=<hex>`,
 * payload `${ts}.${rawBody}` keyed on the endpoint's shared secret.
 *
 * Schema for the inbound webhook secret: a row in `WebhookEndpoint`
 * with `description='storlaunch.inbound'` and the shared secret in
 * `secret`. The merchant config flow surfaces this in the integrations
 * panel; until then the SEED_STORLAUNCH_WEBHOOK_SECRET env var supplies
 * a fallback for dev.
 */
import { Router } from 'express';
import express from 'express';
import { ok, err } from '@forjio/sdk/http';
import crypto from 'node:crypto';
import { prisma } from '../lib/db.js';
import { writeAuditLog } from '../lib/audit.js';

const router = Router();

interface StorlaunchEvent {
  id: string;
  type: string;
  occurredAt?: string;
  accountId: string | null;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function verifySignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const segment of header.split(',')) {
    const [k, v] = segment.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;
  const drift = Math.abs(Math.floor(Date.now() / 1000) - Number.parseInt(ts, 10));
  if (!Number.isFinite(drift) || drift > 300) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${rawBody.toString('utf8')}`)
    .digest('hex');
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

async function loadInboundSecret(accountId: string | null): Promise<string | null> {
  if (accountId) {
    const ep = await prisma.webhookEndpoint.findFirst({
      where: { accountId, description: 'storlaunch.inbound', active: true },
      select: { secret: true },
    });
    if (ep) return ep.secret;
  }
  return process.env.STORLAUNCH_WEBHOOK_SECRET ?? process.env.SEED_STORLAUNCH_WEBHOOK_SECRET ?? null;
}

router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const reqId = req.requestId ?? 'req_unknown';
    const raw = req.body as Buffer;
    let event: StorlaunchEvent;
    try {
      event = JSON.parse(raw.toString('utf8')) as StorlaunchEvent;
    } catch {
      return res.status(400).json(err('MALFORMED', 'body is not JSON', reqId));
    }

    const secret = await loadInboundSecret(event.accountId);
    if (!secret) return res.status(401).json(err('NO_SECRET', 'no webhook secret configured', reqId));
    const sigHeader = req.headers['storlaunch-signature'] as string | undefined;
    if (!verifySignature(raw, sigHeader, secret)) {
      return res.status(401).json(err('BAD_SIGNATURE', 'storlaunch signature invalid', reqId));
    }

    // Idempotency on (eventId).
    const seen = await prisma.processedEvent.findUnique({ where: { eventId: event.id } });
    if (seen) return res.json(ok({ duplicate: true }, reqId));

    try {
      await dispatch(event);
      await prisma.processedEvent.create({ data: { eventId: event.id } });
    } catch (e) {
      console.error('[storlaunch-webhook] dispatch failed', event.id, e);
      return res.status(500).json(err('DISPATCH_FAILED', String(e), reqId));
    }
    res.json(ok({ received: true, type: event.type }, reqId));
  },
);

interface StorlaunchProduct {
  id: string;
  accountId: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  type?: 'physical' | 'digital' | 'license';
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  licenseEnabled?: boolean;
  maxActivations?: number;
  archived?: boolean;
  variants?: StorlaunchVariant[];
}

interface StorlaunchVariant {
  id: string;
  productId: string;
  sku?: string | null;
  name?: string | null;
  priceCents?: number;
  costCents?: number | null;
  lowStockThreshold?: number | null;
  weight?: number | null;
  isDefault?: boolean;
  archived?: boolean;
}

async function dispatch(event: StorlaunchEvent): Promise<void> {
  switch (event.type) {
    case 'storlaunch.product.created.v1':
    case 'storlaunch.product.updated.v1':
      return handleProductUpsert(event);
    case 'storlaunch.product.archived.v1':
      return handleProductArchive(event);
    case 'storlaunch.variant.created.v1':
    case 'storlaunch.variant.updated.v1':
      return handleVariantUpsert(event);
    case 'storlaunch.variant.archived.v1':
      return handleVariantArchive(event);
    default:
      // Unknown types — no-op but record as processed so storlaunch stops retrying.
      return;
  }
}

async function handleProductUpsert(event: StorlaunchEvent): Promise<void> {
  const p = event.data as unknown as StorlaunchProduct;
  if (!p?.id || !p.accountId) throw new Error('product event missing id/accountId');
  const product = await prisma.product.upsert({
    where: {
      accountId_externalSource_externalRef: {
        accountId: p.accountId,
        externalSource: 'storlaunch',
        externalRef: p.id,
      },
    },
    update: {
      name: p.name,
      sku: p.sku ?? null,
      description: p.description ?? null,
      type: p.type ?? 'physical',
      weight: p.weight ?? null,
      length: p.length ?? null,
      width: p.width ?? null,
      height: p.height ?? null,
      licenseEnabled: p.licenseEnabled ?? false,
      maxActivations: p.maxActivations ?? 1,
      archived: p.archived ?? false,
    },
    create: {
      accountId: p.accountId,
      externalSource: 'storlaunch',
      externalRef: p.id,
      name: p.name,
      sku: p.sku ?? null,
      description: p.description ?? null,
      type: p.type ?? 'physical',
      weight: p.weight ?? null,
      length: p.length ?? null,
      width: p.width ?? null,
      height: p.height ?? null,
      licenseEnabled: p.licenseEnabled ?? false,
      maxActivations: p.maxActivations ?? 1,
      archived: p.archived ?? false,
    },
  });

  // Variants: optional embedded list. If present, full-replace via upsert
  // matching on externalRef. Variants not referenced are NOT archived
  // here — separate variant.archived event drives that.
  if (Array.isArray(p.variants)) {
    for (const v of p.variants) {
      await upsertVariant(product.id, v);
    }
  }
  await writeAuditLog(prisma, {
    accountId: p.accountId,
    actorType: 'system',
    action: 'storlaunch.product.synced',
    targetType: 'Product', targetId: product.id,
    after: { externalRef: p.id, type: p.type, name: p.name },
  });
}

async function upsertVariant(localProductId: string, v: StorlaunchVariant): Promise<void> {
  await prisma.productVariant.upsert({
    where: {
      productId_externalSource_externalRef: {
        productId: localProductId,
        externalSource: 'storlaunch',
        externalRef: v.id,
      },
    },
    update: {
      name: v.name ?? 'Default',
      sku: v.sku ?? null,
      priceCents: v.priceCents ?? 0,
      costCents: v.costCents ?? null,
      lowStockThreshold: v.lowStockThreshold ?? null,
      weight: v.weight ?? null,
      isDefault: v.isDefault ?? false,
      archived: v.archived ?? false,
    },
    create: {
      productId: localProductId,
      externalSource: 'storlaunch',
      externalRef: v.id,
      name: v.name ?? 'Default',
      sku: v.sku ?? null,
      priceCents: v.priceCents ?? 0,
      costCents: v.costCents ?? null,
      lowStockThreshold: v.lowStockThreshold ?? null,
      weight: v.weight ?? null,
      isDefault: v.isDefault ?? false,
      archived: v.archived ?? false,
    },
  });
}

async function handleProductArchive(event: StorlaunchEvent): Promise<void> {
  const p = event.data as unknown as StorlaunchProduct;
  if (!p?.id || !p.accountId) return;
  await prisma.product.updateMany({
    where: { accountId: p.accountId, externalSource: 'storlaunch', externalRef: p.id },
    data: { archived: true },
  });
}

async function handleVariantUpsert(event: StorlaunchEvent): Promise<void> {
  const v = event.data as unknown as StorlaunchVariant & { storlaunchProductId?: string };
  // Need the storlaunch productId to find local product; included as
  // `productId` on the variant payload per storlaunch's outbox shape.
  const storlaunchProductId = v.storlaunchProductId ?? v.productId;
  if (!storlaunchProductId) throw new Error('variant event missing productId');
  const accountId = event.accountId;
  if (!accountId) throw new Error('variant event missing accountId');
  const product = await prisma.product.findUnique({
    where: {
      accountId_externalSource_externalRef: {
        accountId,
        externalSource: 'storlaunch',
        externalRef: storlaunchProductId,
      },
    },
  });
  if (!product) throw new Error(`unknown storlaunch product ${storlaunchProductId} — product.created event must precede variant`);
  await upsertVariant(product.id, v);
}

async function handleVariantArchive(event: StorlaunchEvent): Promise<void> {
  const v = event.data as unknown as StorlaunchVariant;
  if (!v?.id) return;
  await prisma.productVariant.updateMany({
    where: { externalSource: 'storlaunch', externalRef: v.id },
    data: { archived: true },
  });
}

export default router;
