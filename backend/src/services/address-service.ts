import type { PrismaClient } from '@prisma/client';
import { createBiteshipAdapter, type BiteshipAdapter } from './shipping-service.js';

type PrismaLike = Pick<PrismaClient, 'customerAddress' | '$transaction'>;

export interface AddressInput {
  label: string;
  contactName: string;
  contactPhone: string;
  email?: string;
  address: string;
  note?: string;
  postalCode?: string;
  areaId?: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

export interface StoredAddress {
  id: string;
  customerId: string;
  accountId: string;
  label: string;
  contactName: string;
  contactPhone: string;
  email: string | null;
  address: string;
  note: string | null;
  postalCode: string | null;
  areaId: string | null;
  lat: number | null;
  lng: number | null;
  biteshipLocationId: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function listAddresses(
  prisma: PrismaLike,
  customerId: string,
): Promise<StoredAddress[]> {
  return prisma.customerAddress.findMany({
    where: { customerId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  }) as unknown as Promise<StoredAddress[]>;
}

export async function getAddress(
  prisma: PrismaLike,
  params: { id: string; customerId: string },
): Promise<StoredAddress | null> {
  const addr = await prisma.customerAddress.findUnique({ where: { id: params.id } });
  if (!addr || addr.customerId !== params.customerId) return null;
  return addr as unknown as StoredAddress;
}

/**
 * Create a new address. If isDefault=true, clears default flag from sibling addresses
 * in the same customer. Uses a transaction to avoid a brief window of 2 defaults.
 */
export async function createAddress(
  prisma: PrismaLike,
  params: { customerId: string; accountId: string; input: AddressInput },
): Promise<StoredAddress> {
  const { input } = params;
  const existing = await prisma.customerAddress.findMany({
    where: { customerId: params.customerId },
    select: { id: true },
  });
  const shouldDefault = input.isDefault === true || existing.length === 0;

  const results = await prisma.$transaction([
    ...(shouldDefault
      ? [prisma.customerAddress.updateMany({
          where: { customerId: params.customerId, isDefault: true },
          data: { isDefault: false },
        })]
      : []),
    prisma.customerAddress.create({
      data: {
        customerId: params.customerId,
        accountId: params.accountId,
        label: input.label,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        email: input.email,
        address: input.address,
        note: input.note,
        postalCode: input.postalCode,
        areaId: input.areaId,
        lat: input.lat,
        lng: input.lng,
        isDefault: shouldDefault,
      },
    }),
  ]);
  const created = results[results.length - 1];
  return created as unknown as StoredAddress;
}

export async function updateAddress(
  prisma: PrismaLike,
  params: { id: string; customerId: string; input: Partial<AddressInput> },
  adapter: BiteshipAdapter = createBiteshipAdapter(),
): Promise<StoredAddress | null> {
  const existing = await prisma.customerAddress.findUnique({ where: { id: params.id } });
  if (!existing || existing.customerId !== params.customerId) return null;

  const { input } = params;
  const ops: Array<ReturnType<typeof prisma.customerAddress.update> | ReturnType<typeof prisma.customerAddress.updateMany>> = [];
  if (input.isDefault === true && !existing.isDefault) {
    ops.push(prisma.customerAddress.updateMany({
      where: { customerId: params.customerId, isDefault: true },
      data: { isDefault: false },
    }));
  }
  ops.push(prisma.customerAddress.update({
    where: { id: params.id },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
      ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
      ...(input.areaId !== undefined ? { areaId: input.areaId } : {}),
      ...(input.lat !== undefined ? { lat: input.lat } : {}),
      ...(input.lng !== undefined ? { lng: input.lng } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    },
  }));
  const results = await prisma.$transaction(ops);
  const updated = results[results.length - 1];

  // If the row has a Biteship mirror, push changes upstream (best-effort).
  if (existing.biteshipLocationId) {
    const mirrorPayload: Record<string, unknown> = {};
    if (input.contactName !== undefined) mirrorPayload.contactName = input.contactName;
    if (input.contactPhone !== undefined) mirrorPayload.contactPhone = input.contactPhone;
    if (input.address !== undefined) mirrorPayload.address = input.address;
    if (input.postalCode !== undefined) mirrorPayload.postalCode = input.postalCode;
    if (input.lat !== undefined) mirrorPayload.lat = input.lat;
    if (input.lng !== undefined) mirrorPayload.lng = input.lng;
    if (input.note !== undefined) mirrorPayload.note = input.note;
    if (Object.keys(mirrorPayload).length > 0) {
      adapter.updateLocation(existing.biteshipLocationId, mirrorPayload).catch((err) => {
        console.error('[address] Biteship Location update failed:', err);
      });
    }
  }

  return updated as unknown as StoredAddress;
}

export async function deleteAddress(
  prisma: PrismaLike,
  params: { id: string; customerId: string },
  adapter: BiteshipAdapter = createBiteshipAdapter(),
): Promise<boolean> {
  const existing = await prisma.customerAddress.findUnique({ where: { id: params.id } });
  if (!existing || existing.customerId !== params.customerId) return false;

  await prisma.customerAddress.delete({ where: { id: params.id } });

  if (existing.biteshipLocationId) {
    adapter.deleteLocation(existing.biteshipLocationId).catch((err) => {
      console.error('[address] Biteship Location delete failed:', err);
    });
  }

  // If we deleted the default, promote the most recent remaining address.
  if (existing.isDefault) {
    const next = await prisma.customerAddress.findFirst({
      where: { customerId: params.customerId },
      orderBy: { updatedAt: 'desc' },
    });
    if (next) {
      await prisma.customerAddress.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
  return true;
}

export async function setDefault(
  prisma: PrismaLike,
  params: { id: string; customerId: string },
): Promise<StoredAddress | null> {
  const existing = await prisma.customerAddress.findUnique({ where: { id: params.id } });
  if (!existing || existing.customerId !== params.customerId) return null;
  const results = await prisma.$transaction([
    prisma.customerAddress.updateMany({
      where: { customerId: params.customerId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.customerAddress.update({
      where: { id: params.id },
      data: { isDefault: true },
    }),
  ]);
  return results[1] as unknown as StoredAddress;
}

/**
 * Ensure a Biteship Location mirror exists for this address. Called lazily on
 * first order creation — avoids burning API calls on addresses that never ship.
 */
export async function ensureBiteshipLocation(
  prisma: PrismaLike,
  params: { addressId: string },
  adapter: BiteshipAdapter = createBiteshipAdapter(),
): Promise<string | null> {
  const addr = await prisma.customerAddress.findUnique({ where: { id: params.addressId } });
  if (!addr) return null;
  if (addr.biteshipLocationId) return addr.biteshipLocationId;

  try {
    const loc = await adapter.createLocation({
      name: `${addr.label} — ${addr.contactName}`,
      contactName: addr.contactName,
      contactPhone: addr.contactPhone,
      address: addr.address,
      postalCode: addr.postalCode ?? undefined,
      lat: addr.lat ?? undefined,
      lng: addr.lng ?? undefined,
      note: addr.note ?? undefined,
      type: 'destination',
    });
    await prisma.customerAddress.update({
      where: { id: addr.id },
      data: { biteshipLocationId: loc.id },
    });
    return loc.id;
  } catch (err) {
    // Swallow — order creation can still proceed with inline payload.
    console.error('[address] Biteship Location create failed:', err);
    return null;
  }
}

/**
 * Ensure the merchant origin (BiteshipConfig row) has a Biteship Location
 * mirror. Called before order creation so instant couriers get validated
 * geocoding.
 */
export async function ensureBiteshipOriginLocation(
  prisma: Pick<PrismaClient, 'biteshipConfig'>,
  accountId: string,
  adapter?: BiteshipAdapter,
): Promise<string | null> {
  const cfg = await prisma.biteshipConfig.findUnique({ where: { accountId } });
  if (!cfg) return null;
  if (cfg.biteshipOriginLocationId) return cfg.biteshipOriginLocationId;
  if (!cfg.originAddress || !cfg.contactName || !cfg.contactPhone) {
    return null; // Origin not configured — cannot mirror.
  }

  const ad = adapter ?? createBiteshipAdapter({ apiKey: cfg.apiKey ?? null });

  try {
    const loc = await ad.createLocation({
      name: `acc_${accountId} — Origin`,
      contactName: cfg.contactName,
      contactPhone: cfg.contactPhone,
      address: cfg.originAddress,
      postalCode: cfg.originPostal ?? undefined,
      lat: cfg.originLat ?? undefined,
      lng: cfg.originLng ?? undefined,
      type: 'origin',
    });
    await prisma.biteshipConfig.update({
      where: { accountId },
      data: { biteshipOriginLocationId: loc.id },
    });
    return loc.id;
  } catch (err) {
    console.error('[address] Biteship origin Location create failed:', err);
    return null;
  }
}
