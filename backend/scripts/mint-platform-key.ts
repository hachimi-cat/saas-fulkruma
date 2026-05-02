/**
 * Mint a platform-admin API key for a partner (Storlaunch / Ripllo …).
 *
 * Idempotent: if a partner already has a non-revoked key, prints the
 * existing keyId and tells you the secret was shown once. Pass
 * `--rotate` to force-revoke + re-mint a fresh key (the old one stops
 * working immediately).
 *
 * Usage:
 *   tsx scripts/mint-platform-key.ts --partner storlaunch
 *   tsx scripts/mint-platform-key.ts --partner storlaunch --rotate
 *   tsx scripts/mint-platform-key.ts --partner ripllo --name "Ripllo prod"
 */
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function newKeyId(prefix: string): string {
  return `AKIAFULK${prefix.toUpperCase()}${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}
function newSecret(): string {
  return `fulksk_platform_${crypto.randomBytes(32).toString('base64url')}`;
}
function preview(secret: string): string {
  return `${secret.slice(0, 8)}…${secret.slice(-4)}`;
}

async function main() {
  const partner = (arg('partner') ?? '').toLowerCase();
  if (!partner) {
    console.error('--partner <slug> is required (e.g. storlaunch, ripllo)');
    process.exit(2);
  }
  const name = arg('name') ?? `${partner[0].toUpperCase()}${partner.slice(1)} platform admin`;
  const rotate = flag('rotate');

  // Owner accountId — for partner keys we use a synthetic fulkruma-internal
  // marker so it doesn't collide with a real merchant.
  const accountId = `partner_${partner}`;

  const existing = await prisma.apiKey.findFirst({
    where: { partner, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (existing && !rotate) {
    console.log(JSON.stringify({
      partner,
      keyId: existing.keyId,
      created: existing.createdAt,
      note: 'Key already exists. The secret was shown once at creation. Pass --rotate to re-mint.',
    }, null, 2));
    return;
  }
  if (existing && rotate) {
    await prisma.apiKey.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
    console.log(`[mint] revoked old key ${existing.keyId}`);
  }

  const keyId = newKeyId(partner.slice(0, 3));
  const secret = newSecret();
  await prisma.apiKey.create({
    data: {
      accountId,
      partner,
      name,
      keyId,
      secretHash: secret, // stored RAW per the hmac-auth comment
      secretPreview: preview(secret),
      scopes: ['fulkruma:platform:admin', 'read', 'write'],
    },
  });
  console.log(JSON.stringify({
    partner,
    keyId,
    secret,
    note: 'Save this secret — it is shown only once. Drop into the partner repo`s env file.',
  }, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
