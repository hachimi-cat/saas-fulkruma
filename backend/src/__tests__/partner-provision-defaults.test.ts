import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
 * ensurePartnerPaidTier — partner-provisioned workspaces are PAID for
 * through the host product, so they must land on the first PAID plan
 * (STARTER), not the FREE plan the gates fall back to. This is a FLOOR:
 *   - no Subscription row  → create at STARTER
 *   - plan === FREE        → lift to STARTER
 *   - any higher plan      → left untouched (never downgrade)
 *
 * Prisma is mocked so the floor logic is testable without a database,
 * matching the convention in admin-crm.test.ts.
 */

const { findUnique, create, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(async () => ({})),
  update: vi.fn(async () => ({})),
}));

vi.mock('../lib/db.js', () => ({
  prisma: {
    subscription: { findUnique, create, update },
  },
}));

import { ensurePartnerPaidTier } from '../services/billing.js';

const ACC = 'acc_test_partner_floor';

describe('ensurePartnerPaidTier', () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset().mockResolvedValue({});
    update.mockReset().mockResolvedValue({});
  });

  it('floors a fresh partner workspace at the first paid plan (STARTER, not FREE)', async () => {
    findUnique.mockResolvedValue(null);
    await ensurePartnerPaidTier(ACC);
    expect(create).toHaveBeenCalledWith({ data: { accountId: ACC, plan: 'STARTER' } });
    expect(update).not.toHaveBeenCalled();
  });

  it('lifts an existing FREE workspace to STARTER', async () => {
    findUnique.mockResolvedValue({ plan: 'FREE' });
    await ensurePartnerPaidTier(ACC);
    expect(update).toHaveBeenCalledWith({ where: { accountId: ACC }, data: { plan: 'STARTER' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('does not downgrade a partner workspace already on a higher plan (SCALE)', async () => {
    findUnique.mockResolvedValue({ plan: 'SCALE' });
    await ensurePartnerPaidTier(ACC);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
