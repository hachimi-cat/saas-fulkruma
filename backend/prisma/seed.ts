/**
 * Dev-only seed. Inserts realistic example data for bang's portal eval.
 *
 * Idempotent: re-running re-uses the same fixture IDs. Safe to call
 * after migrations during local dev. NOT called by `prisma migrate
 * deploy` (staging/prod), so it won't run there.
 *
 * Run via: `npm run prisma:seed` or directly:
 *   tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Bang's huudis user_id is the merchant accountId in single-user mode.
const ACCOUNT_ID = process.env.SEED_ACCOUNT_ID ?? 'usr_01KPHFKMCERET4RYTBPHKVK4ET';
const SEED_USER = ACCOUNT_ID;

async function main() {
  console.log(`[seed] account=${ACCOUNT_ID}`);

  // ─── Warehouses ──────────────────────────────────────────────────
  const jakarta = await prisma.warehouse.upsert({
    where: { id: 'wh_seed_jakarta' },
    update: {},
    create: {
      id: 'wh_seed_jakarta',
      accountId: ACCOUNT_ID,
      name: 'Jakarta Main DC',
      address: 'Jl. Cilandak Tengah No. 12',
      city: 'Jakarta Selatan',
      postal: '12430',
      phone: '+62 21 1234 5678',
      isDefault: true,
    },
  });
  const bandung = await prisma.warehouse.upsert({
    where: { id: 'wh_seed_bandung' },
    update: {},
    create: {
      id: 'wh_seed_bandung',
      accountId: ACCOUNT_ID,
      name: 'Bandung Storage',
      address: 'Jl. Asia Afrika No. 81',
      city: 'Bandung',
      postal: '40111',
      phone: '+62 22 2345 6789',
    },
  });
  const surabaya = await prisma.warehouse.upsert({
    where: { id: 'wh_seed_surabaya' },
    update: {},
    create: {
      id: 'wh_seed_surabaya',
      accountId: ACCOUNT_ID,
      name: 'Surabaya East Hub',
      address: 'Jl. Tunjungan No. 45',
      city: 'Surabaya',
      postal: '60275',
      phone: '+62 31 3456 7890',
    },
  });

  // ─── Products + variants (fulkruma-owned catalogue) ─────────────
  const tshirt = await prisma.product.upsert({
    where: { id: 'prod_seed_tshirt' },
    update: {},
    create: {
      id: 'prod_seed_tshirt',
      accountId: ACCOUNT_ID,
      name: 'Forjio Tee',
      sku: 'FRJ-TEE',
      description: 'Soft cotton tee. Indonesian-made.',
      type: 'physical',
      weight: 250, length: 30, width: 22, height: 2,
    },
  });
  await prisma.productVariant.upsert({
    where: { id: 'var_tshirt_blk_m' },
    update: {},
    create: { id: 'var_tshirt_blk_m', productId: tshirt.id, name: 'Black / M', sku: 'FRJ-TEE-BLK-M', priceCents: 19900 },
  });
  await prisma.productVariant.upsert({
    where: { id: 'var_tshirt_blk_l' },
    update: {},
    create: { id: 'var_tshirt_blk_l', productId: tshirt.id, name: 'Black / L', sku: 'FRJ-TEE-BLK-L', priceCents: 19900 },
  });
  await prisma.productVariant.upsert({
    where: { id: 'var_tshirt_wht_m' },
    update: {},
    create: { id: 'var_tshirt_wht_m', productId: tshirt.id, name: 'White / M', sku: 'FRJ-TEE-WHT-M', priceCents: 19900, lowStockThreshold: 20, isDefault: true },
  });
  await prisma.productVariant.upsert({
    where: { id: 'var_tshirt_wht_l' },
    update: {},
    create: { id: 'var_tshirt_wht_l', productId: tshirt.id, name: 'White / L', sku: 'FRJ-TEE-WHT-L', priceCents: 19900 },
  });

  const hoodie = await prisma.product.upsert({
    where: { id: 'prod_seed_hoodie' },
    update: {},
    create: {
      id: 'prod_seed_hoodie',
      accountId: ACCOUNT_ID,
      name: 'Forjio Hoodie',
      sku: 'FRJ-HOOD',
      description: 'Heavyweight cotton hoodie.',
      type: 'physical',
      weight: 700, length: 35, width: 28, height: 5,
    },
  });
  await prisma.productVariant.upsert({
    where: { id: 'var_hoodie_nav_m' },
    update: {},
    create: { id: 'var_hoodie_nav_m', productId: hoodie.id, name: 'Navy / M', sku: 'FRJ-HOOD-NAV-M', priceCents: 49900, isDefault: true },
  });

  const cap = await prisma.product.upsert({
    where: { id: 'prod_seed_cap' },
    update: {},
    create: {
      id: 'prod_seed_cap',
      accountId: ACCOUNT_ID,
      name: 'Forjio Cap',
      sku: 'FRJ-CAP',
      type: 'physical',
      weight: 120, length: 22, width: 22, height: 12,
    },
  });
  await prisma.productVariant.upsert({
    where: { id: 'var_cap_red_os' },
    update: {},
    create: { id: 'var_cap_red_os', productId: cap.id, name: 'Red / OneSize', sku: 'FRJ-CAP-RED', priceCents: 14900, isDefault: true },
  });

  // Digital + license-bearing products for the deliveries / licenses pages.
  const ebook = await prisma.product.upsert({
    where: { id: 'prod_seed_ebook' },
    update: {},
    create: { id: 'prod_seed_ebook', accountId: ACCOUNT_ID, name: 'Forjio Handbook (PDF)', type: 'digital', sku: 'FRJ-PDF-HBK' },
  });
  await prisma.productVariant.upsert({
    where: { id: 'var_ebook_default' },
    update: {},
    create: { id: 'var_ebook_default', productId: ebook.id, name: 'Default', isDefault: true, priceCents: 99000 },
  });

  const proApp = await prisma.product.upsert({
    where: { id: 'prod_seed_pro_app' },
    update: {},
    create: { id: 'prod_seed_pro_app', accountId: ACCOUNT_ID, name: 'Forjio Pro Desktop App', type: 'license', sku: 'FRJ-PROAPP', licenseEnabled: true, maxActivations: 3 },
  });
  await prisma.productVariant.upsert({
    where: { id: 'var_proapp_default' },
    update: {},
    create: { id: 'var_proapp_default', productId: proApp.id, name: 'Default', isDefault: true, priceCents: 599000 },
  });

  const templatePack = await prisma.product.upsert({
    where: { id: 'prod_seed_template_pack' },
    update: {},
    create: { id: 'prod_seed_template_pack', accountId: ACCOUNT_ID, name: 'Notion Template Pack', type: 'digital', sku: 'FRJ-NTNPACK' },
  });
  await prisma.productVariant.upsert({
    where: { id: 'var_template_pack_default' },
    update: {},
    create: { id: 'var_template_pack_default', productId: templatePack.id, name: 'Default', isDefault: true, priceCents: 49000 },
  });

  // ─── Stock per variant per warehouse ─────────────────────────────
  const variants = [
    { id: 'var_tshirt_blk_m', name: 'T-Shirt Black / M' },
    { id: 'var_tshirt_blk_l', name: 'T-Shirt Black / L' },
    { id: 'var_tshirt_wht_m', name: 'T-Shirt White / M' },
    { id: 'var_tshirt_wht_l', name: 'T-Shirt White / L' },
    { id: 'var_hoodie_nav_m', name: 'Hoodie Navy / M' },
    { id: 'var_cap_red_os', name: 'Cap Red / OneSize' },
  ];
  const distribution: Array<[string, string, number]> = [
    ['var_tshirt_blk_m', jakarta.id, 240],
    ['var_tshirt_blk_m', bandung.id, 84],
    ['var_tshirt_blk_l', jakarta.id, 198],
    ['var_tshirt_wht_m', jakarta.id, 18], // intentionally low for the "low stock" badge
    ['var_tshirt_wht_l', jakarta.id, 72],
    ['var_hoodie_nav_m', jakarta.id, 96],
    ['var_hoodie_nav_m', surabaya.id, 28],
    ['var_cap_red_os', jakarta.id, 142],
    ['var_cap_red_os', bandung.id, 65],
  ];
  for (const [variantId, warehouseId, qty] of distribution) {
    await prisma.variantStock.upsert({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      update: { quantity: qty },
      create: { variantId, warehouseId, quantity: qty },
    });
    // Seed an initial_stock movement so the ledger isn't empty.
    await prisma.stockMovement.create({
      data: {
        variantId,
        warehouseId,
        delta: qty,
        reason: 'initial_stock',
        note: 'seed',
        createdBy: SEED_USER,
      },
    }).catch(() => {/* idempotent — duplicate is fine */});
  }

  // ─── Stock reservations (open checkouts soft-holding stock) ──────
  await prisma.stockReservation.create({
    data: {
      variantId: 'var_tshirt_blk_m',
      warehouseId: jakarta.id,
      quantity: 2,
      checkoutSessionId: 'cs_seed_001',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  }).catch(() => {});
  await prisma.stockReservation.create({
    data: {
      variantId: 'var_hoodie_nav_m',
      warehouseId: jakarta.id,
      quantity: 1,
      checkoutSessionId: 'cs_seed_002',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  }).catch(() => {});

  // ─── Buyer addresses ────────────────────────────────────────────
  await prisma.customerAddress.upsert({
    where: { id: 'addr_seed_001' },
    update: {},
    create: {
      id: 'addr_seed_001',
      accountId: ACCOUNT_ID,
      customerId: 'cust_seed_buyer_a',
      label: 'Home',
      contactName: 'Bayu Widjaja',
      contactPhone: '+62 812 3456 7890',
      email: 'bayu@example.com',
      address: 'Jl. Kemang Selatan No. 8',
      postalCode: '12730',
      isDefault: true,
    },
  });
  await prisma.customerAddress.upsert({
    where: { id: 'addr_seed_002' },
    update: {},
    create: {
      id: 'addr_seed_002',
      accountId: ACCOUNT_ID,
      customerId: 'cust_seed_buyer_a',
      label: 'Office',
      contactName: 'Bayu Widjaja',
      contactPhone: '+62 812 3456 7890',
      address: 'Wisma 46, Sudirman',
      postalCode: '10220',
    },
  });
  await prisma.customerAddress.upsert({
    where: { id: 'addr_seed_003' },
    update: {},
    create: {
      id: 'addr_seed_003',
      accountId: ACCOUNT_ID,
      customerId: 'cust_seed_buyer_b',
      label: 'Home',
      contactName: 'Sari Putri',
      contactPhone: '+62 813 9876 5432',
      email: 'sari@example.com',
      address: 'Komp. Setiabudi Indah blok B/22',
      postalCode: '40143',
      isDefault: true,
    },
  });

  // ─── Shipments + events ─────────────────────────────────────────
  const shipment1 = await prisma.shipment.upsert({
    where: { biteshipOrderId: 'bs_seed_001' },
    update: {},
    create: {
      accountId: ACCOUNT_ID,
      biteshipOrderId: 'bs_seed_001',
      biteshipTrackingId: 'TRK-AB12-CD34',
      waybillId: 'JNE-2026050001',
      courierCode: 'jne',
      courierServiceCode: 'reg',
      courierType: 'regular',
      status: 'in_transit',
      trackingUrl: 'https://www.jne.co.id/id/tracking?awb=JNE-2026050001',
      price: 18000,
      insurance: 0,
      insured: false,
      checkoutSessionId: 'cs_seed_paid_001',
      customerId: 'cust_seed_buyer_a',
      customerEmail: 'bayu@example.com',
      originSnapshot: {
        address: 'Jl. Cilandak Tengah No. 12',
        city: 'Jakarta Selatan',
        postal: '12430',
        contactName: 'Fulkruma DC',
        contactPhone: '+62 21 1234 5678',
      },
      destinationSnapshot: {
        address: 'Jl. Kemang Selatan No. 8',
        city: 'Jakarta Selatan',
        postal: '12730',
        contactName: 'Bayu Widjaja',
        contactPhone: '+62 812 3456 7890',
        email: 'bayu@example.com',
      },
      items: [{ productId: 'prod_demo_tshirt', name: 'T-Shirt Black / M', qty: 1, weight: 250, value: 199000 }],
    },
  });
  await prisma.shipmentEvent.createMany({
    data: [
      { shipmentId: shipment1.id, status: 'pending', occurredAt: new Date(Date.now() - 26 * 3600 * 1000), note: 'Order created' },
      { shipmentId: shipment1.id, status: 'confirmed', occurredAt: new Date(Date.now() - 24 * 3600 * 1000), note: 'Courier confirmed' },
      { shipmentId: shipment1.id, status: 'picked_up', occurredAt: new Date(Date.now() - 18 * 3600 * 1000), note: 'Picked up at origin' },
      { shipmentId: shipment1.id, status: 'in_transit', occurredAt: new Date(Date.now() - 6 * 3600 * 1000), note: 'In transit, sorting facility Jakarta' },
    ],
    skipDuplicates: true,
  });

  await prisma.shipment.upsert({
    where: { biteshipOrderId: 'bs_seed_002' },
    update: {},
    create: {
      accountId: ACCOUNT_ID,
      biteshipOrderId: 'bs_seed_002',
      waybillId: 'SCP-2026050007',
      courierCode: 'sicepat',
      courierServiceCode: 'reg',
      courierType: 'regular',
      status: 'delivered',
      price: 15000,
      checkoutSessionId: 'cs_seed_paid_002',
      customerId: 'cust_seed_buyer_b',
      customerEmail: 'sari@example.com',
      originSnapshot: { city: 'Jakarta Selatan' },
      destinationSnapshot: { city: 'Bandung' },
      items: [{ productId: 'prod_demo_cap', name: 'Cap Red / OneSize', qty: 2, value: 89000 }],
    },
  });

  // ─── Licenses + activations ─────────────────────────────────────
  const license1 = await prisma.license.upsert({
    where: { key: 'FLKR-7K3PH-9X2RM-NQB4T' },
    update: {},
    create: {
      accountId: ACCOUNT_ID,
      productId: 'prod_demo_pro_app',
      customerId: 'cust_seed_buyer_a',
      key: 'FLKR-7K3PH-9X2RM-NQB4T',
      maxActivations: 3,
    },
  });
  await prisma.licenseActivation.upsert({
    where: { licenseId_instanceId: { licenseId: license1.id, instanceId: 'macbook-pro-bayu' } },
    update: {},
    create: { licenseId: license1.id, instanceId: 'macbook-pro-bayu' },
  });
  await prisma.license.update({
    where: { id: license1.id },
    data: { activations: 1 },
  }).catch(() => {});

  await prisma.license.upsert({
    where: { key: 'FLKR-9P4MR-X8Z2K-VBC7H' },
    update: {},
    create: {
      accountId: ACCOUNT_ID,
      productId: 'prod_demo_pro_app',
      customerId: 'cust_seed_buyer_b',
      key: 'FLKR-9P4MR-X8Z2K-VBC7H',
      maxActivations: 1,
    },
  });

  // ─── Digital deliveries ──────────────────────────────────────────
  await prisma.delivery.upsert({
    where: { checkoutSessionId: 'cs_seed_digital_001' },
    update: {},
    create: {
      accountId: ACCOUNT_ID,
      productId: 'prod_demo_ebook',
      customerId: 'cust_seed_buyer_a',
      checkoutSessionId: 'cs_seed_digital_001',
      downloadCount: 1,
      maxDownloads: 5,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  await prisma.delivery.upsert({
    where: { checkoutSessionId: 'cs_seed_digital_002' },
    update: {},
    create: {
      accountId: ACCOUNT_ID,
      productId: 'prod_demo_template_pack',
      customerId: 'cust_seed_buyer_b',
      checkoutSessionId: 'cs_seed_digital_002',
      downloadCount: 0,
      maxDownloads: 3,
      expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    },
  });

  // ─── API keys ────────────────────────────────────────────────────
  await prisma.apiKey.upsert({
    where: { keyId: 'AKIAFULK_DEV_LOCAL_DEMO' },
    update: {},
    create: {
      accountId: ACCOUNT_ID,
      name: 'Local development',
      keyId: 'AKIAFULK_DEV_LOCAL_DEMO',
      secretHash: 'sha256_placeholder_seed_only',
      secretPreview: 'fulk…demo',
      scopes: ['read', 'write'],
      createdBy: SEED_USER,
    },
  });

  // ─── Webhook endpoints ──────────────────────────────────────────
  await prisma.webhookEndpoint.upsert({
    where: { id: 'wh_seed_storlaunch' },
    update: {},
    create: {
      id: 'wh_seed_storlaunch',
      accountId: ACCOUNT_ID,
      url: 'https://storlaunch.com/api/v1/webhooks/fulkruma',
      secret: 'whsec_seed_only_replace_in_prod',
      events: ['fulkruma.shipment.*', 'fulkruma.license.issued.v1', 'fulkruma.delivery.created.v1'],
      description: 'Storlaunch — order fulfilment notifications',
    },
  });

  // ─── Audit log ──────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        accountId: ACCOUNT_ID,
        actorType: 'user',
        actorId: SEED_USER,
        actorEmail: 'adhya@forjio.com',
        action: 'warehouse.created',
        targetType: 'Warehouse',
        targetId: jakarta.id,
        ip: '127.0.0.1',
        after: { name: jakarta.name, isDefault: true },
      },
      {
        accountId: ACCOUNT_ID,
        actorType: 'user',
        actorId: SEED_USER,
        actorEmail: 'adhya@forjio.com',
        action: 'warehouse.created',
        targetType: 'Warehouse',
        targetId: bandung.id,
        ip: '127.0.0.1',
        after: { name: bandung.name },
      },
      {
        accountId: ACCOUNT_ID,
        actorType: 'system',
        action: 'shipment.created',
        targetType: 'Shipment',
        targetId: shipment1.id,
        after: { courier: 'jne', service: 'reg' },
      },
      {
        accountId: ACCOUNT_ID,
        actorType: 'user',
        actorId: SEED_USER,
        actorEmail: 'adhya@forjio.com',
        action: 'license.issued',
        targetType: 'License',
        targetId: license1.id,
      },
    ],
    skipDuplicates: true,
  });

  // ─── Biteship config + shipping origin ──────────────────────────
  // The shipping page reads from BiteshipConfig (origin* + contact* +
  // enabledCouriers) — give it sane defaults so the form renders pre-
  // filled in dev.
  await prisma.biteshipConfig.upsert({
    where: { accountId: ACCOUNT_ID },
    update: {},
    create: {
      accountId: ACCOUNT_ID,
      enabledCouriers: [
        'jne', 'jnt', 'pos', 'sicepat', 'wahana', 'sap', 'ninja', 'tiki',
        'lion', 'anteraja', 'idexpress',
      ],
      defaultCourier: 'jne',
      defaultOriginId: 'addr_seed_001',
      active: false, // off until merchant pastes their Biteship API key
      // Shipping origin — same as the Jakarta DC warehouse above so the
      // form lights up with a real address on first load.
      originAddress: 'Jl. Cilandak Tengah No. 12',
      originProvince: 'DKI Jakarta',
      originCity: 'Jakarta Selatan',
      originPostal: '12430',
      originLat: -6.2926,
      originLng: 106.7969,
      contactName: 'Fulkruma DC',
      contactPhone: '+62 21 1234 5678',
    },
  });

  console.log('[seed] done.');
}

main()
  .catch((e) => {
    console.error('[seed] error', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
