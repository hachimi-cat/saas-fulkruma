import { describe, expect, it } from 'vitest';
import { generateShipmentLabel, type ShipmentLabelSize } from '../services/shipment-label-service.js';

const shipment = {
  id: 'sh_test',
  checkoutSessionId: 'checkout_test',
  externalRef: 'ORD-2026-0815',
  waybillId: 'JO0327373568',
  courierCode: 'jne',
  courierServiceCode: 'reg',
  price: 38_000,
  insurance: 2_000,
  insured: true,
  originSnapshot: {
    contactName: 'Kedai Demo',
    contactPhone: '0812-0000-0000',
    address: 'Jl. Kenanga No. 12',
    city: 'Medan',
    postalCode: '20154',
  },
  destinationSnapshot: {
    contactName: 'Rani Putri',
    contactPhone: '0813-0000-0000',
    address: 'Jl. Merdeka No. 8',
    city: 'Bengkulu',
    postalCode: '38222',
  },
  items: [
    { name: 'Cireng Ayam Pedas', description: 'Sharing pack', sku: 'CRG-06', quantity: 3, weight: 600, value: 50_000 },
  ],
} as const;

const expectedMediaBoxes: Record<ShipmentLabelSize, string> = {
  a4: '/MediaBox [0 0 595.275591 841.889764]',
  'thermal-80x100': '/MediaBox [0 0 226.771654 283.464567]',
  'thermal-100x150': '/MediaBox [0 0 283.464567 425.19685]',
};

describe('shipment label generator', () => {
  it.each(Object.keys(expectedMediaBoxes) as ShipmentLabelSize[])('generates a valid %s PDF at the exact page size', async (size) => {
    const label = await generateShipmentLabel(shipment as never, { size });
    const pdf = Buffer.from(label.base64, 'base64');

    expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.3');
    expect(pdf.length).toBeGreaterThan(2_000);
    expect(pdf.toString('latin1')).toContain(expectedMediaBoxes[size]);
    expect(label).toMatchObject({
      contentType: 'application/pdf',
      size,
      waybillId: 'JO0327373568',
    });
    expect(label.fileName).toBe(`shipping-label-JO0327373568-${size}.pdf`);
  });

  it('supports privacy/detail options without changing the shipment source data', async () => {
    const before = JSON.stringify(shipment);
    const label = await generateShipmentLabel(shipment as never, {
      maskRecipientName: true,
      showRecipientPhone: false,
      showSenderPhone: false,
      showItems: false,
      showShippingCost: false,
      showInsurance: false,
    });

    expect(Buffer.from(label.base64, 'base64').length).toBeGreaterThan(2_000);
    expect(JSON.stringify(shipment)).toBe(before);
  });

  it('refuses to generate a label before an AWB exists', async () => {
    await expect(generateShipmentLabel({ ...shipment, waybillId: null } as never))
      .rejects.toThrow('Shipment has no AWB yet');
  });
});
