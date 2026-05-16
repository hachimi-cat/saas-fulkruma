import { Router } from 'express';
import { ok, err } from '@forjio/sdk/http';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { ACTIVE_SHIPMENT_STATUSES } from '../lib/shipment-status.js';

const router = Router();
router.use(requireAuth);

// Powers the /dashboard overview tiles.
router.get('/overview', async (req, res) => {
  const accountId = req.auth?.accountId;
  if (!accountId) return res.status(403).json(err('NO_ACCOUNT', 'token missing accountId', req.requestId ?? 'req_unknown'));

  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [
    activeWarehouses,
    skuCount,
    shipmentsInTransit,
    activeLicenses,
    deliveries30d,
    openReservations,
    pendingShipments,
    deliveredLast30d,
  ] = await Promise.all([
    prisma.warehouse.count({ where: { accountId, archived: false } }),
    prisma.variantStock.count({ where: { warehouse: { accountId } } }),
    prisma.shipment.count({
      // "Active" = anything still in the courier network. Sourced from
      // the shared descriptors module so this list stays in step with
      // the enum (F-003).
      where: {
        accountId,
        status: { in: ACTIVE_SHIPMENT_STATUSES as never },
      },
    }),
    prisma.license.count({ where: { accountId, status: 'active' } }),
    prisma.delivery.count({ where: { accountId, createdAt: { gte: since30d } } }),
    prisma.stockReservation.count({
      where: { warehouse: { accountId }, consumedAt: null, releasedAt: null, expiresAt: { gt: new Date() } },
    }),
    prisma.shipment.count({ where: { accountId, status: 'pending' } }),
    prisma.shipment.count({ where: { accountId, status: 'delivered', updatedAt: { gte: since30d } } }),
  ]);

  const recentShipments = await prisma.shipment.findMany({
    where: { accountId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, status: true, courierCode: true, waybillId: true, customerEmail: true, updatedAt: true },
  });
  const recentMovements = await prisma.stockMovement.findMany({
    where: { warehouse: { accountId } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, variantId: true, warehouseId: true, delta: true, reason: true, createdAt: true, warehouse: { select: { name: true } } },
  });

  res.json(ok({
    counters: {
      activeWarehouses,
      skuCount,
      shipmentsInTransit,
      activeLicenses,
      deliveries30d,
      openReservations,
      pendingShipments,
      deliveredLast30d,
    },
    recent: {
      shipments: recentShipments,
      movements: recentMovements,
    },
  }, req.requestId ?? 'req_unknown'));
});

export default router;
