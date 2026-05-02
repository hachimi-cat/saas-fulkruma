import { ulid } from 'ulid';
import type { Prisma } from '@prisma/client';

/** Build a fulkruma outbox event. Pass to prisma.outboxEvent.create
 *  inside the same txn as the state change. */
export function buildEvent(params: {
  type: string;
  accountId?: string | null;
  data: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}): Prisma.OutboxEventCreateInput {
  return {
    id: `evt_${ulid()}`,
    type: params.type,
    accountId: params.accountId ?? null,
    occurredAt: new Date(),
    data: params.data,
    metadata: params.metadata ?? {},
  };
}
