import { Prisma, type PrismaClient } from '@prisma/client';

export interface AuditEntry {
  accountId: string;
  actorType: 'user' | 'system' | 'api_key';
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

/** Write a single audit log row. Best-effort — failures are logged but
 *  swallowed so audit never breaks the underlying request. */
export async function writeAuditLog(
  client: PrismaClient | Prisma.TransactionClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        accountId: entry.accountId,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        before: entry.before ?? Prisma.JsonNull,
        after: entry.after ?? Prisma.JsonNull,
        metadata: entry.metadata ?? {},
      },
    });
  } catch (e) {
    console.error('[audit] failed to write entry', entry.action, e);
  }
}
