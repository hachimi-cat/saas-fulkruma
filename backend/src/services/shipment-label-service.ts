import PDFDocument from 'pdfkit';
import type { Shipment } from '@prisma/client';
import { fileURLToPath } from 'node:url';

const PT_PER_MM = 72 / 25.4;

export const COURIER_LOGO_CODES = [
  'jne', 'jnt', 'pos', 'sicepat', 'wahana', 'sap', 'ninja', 'tiki',
  'lion', 'anteraja', 'idexpress', 'lalamove', 'grab', 'deliveree', 'gojek', 'borzo',
] as const;

type CourierLogoCode = (typeof COURIER_LOGO_CODES)[number];

const courierLogoFiles = Object.fromEntries(
  COURIER_LOGO_CODES.map((code) => [
    code,
    fileURLToPath(new URL(`../../assets/couriers/${code}.png`, import.meta.url)),
  ]),
) as Record<CourierLogoCode, string>;

const courierLogoBackgrounds: Partial<Record<CourierLogoCode, string>> = {
  jnt: '#E60012',
  ninja: '#C8102E',
  gojek: '#00AA13',
};

const GELLIX_SEMIBOLD = fileURLToPath(
  new URL('../../assets/fonts/Gellix-SemiBold.ttf', import.meta.url),
);

export const SHIPMENT_LABEL_SIZES = ['a4', 'thermal-80x100', 'thermal-100x150'] as const;
export type ShipmentLabelSize = (typeof SHIPMENT_LABEL_SIZES)[number];

export interface ShipmentLabelOptions {
  size: ShipmentLabelSize;
  showSenderPhone: boolean;
  showRecipientPhone: boolean;
  maskRecipientName: boolean;
  showShippingCost: boolean;
  showInsurance: boolean;
  showItems: boolean;
  showItemDescriptions: boolean;
  showItemSkus: boolean;
}

export interface ShipmentLabelFile {
  fileName: string;
  contentType: 'application/pdf';
  base64: string;
  size: ShipmentLabelSize;
  waybillId: string;
}

type LabelShipment = Pick<
  Shipment,
  | 'id'
  | 'checkoutSessionId'
  | 'waybillId'
  | 'courierCode'
  | 'courierServiceCode'
  | 'price'
  | 'insurance'
  | 'insured'
  | 'originSnapshot'
  | 'destinationSnapshot'
  | 'items'
  | 'externalRef'
>;

const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw',
  C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
  G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww',
  O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn',
  S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw',
  W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

const sizePoints: Record<ShipmentLabelSize, [number, number]> = {
  a4: [210 * PT_PER_MM, 297 * PT_PER_MM],
  'thermal-80x100': [80 * PT_PER_MM, 100 * PT_PER_MM],
  'thermal-100x150': [100 * PT_PER_MM, 150 * PT_PER_MM],
};

export function defaultShipmentLabelOptions(size: ShipmentLabelSize = 'thermal-100x150'): ShipmentLabelOptions {
  return {
    size,
    showSenderPhone: true,
    showRecipientPhone: false,
    maskRecipientName: true,
    showShippingCost: true,
    showInsurance: true,
    showItems: true,
    showItemDescriptions: true,
    showItemSkus: true,
  };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function pick(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function clean(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function maskName(name: string): string {
  const words = clean(name).split(' ').filter(Boolean);
  return words.map((word) => word.length <= 1 ? '*' : `${word[0]}${'*'.repeat(Math.min(word.length - 1, 6))}`).join(' ');
}

function formatMoney(value: number): string {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`;
}

function formatAddress(snapshot: Record<string, unknown>): string[] {
  const primary = pick(snapshot, 'address', 'line1', 'addressLine1', 'street');
  const locality = [
    pick(snapshot, 'village', 'administrative_division_level_4_name'),
    pick(snapshot, 'district', 'administrative_division_level_3_name'),
    pick(snapshot, 'city', 'administrative_division_level_2_name'),
    pick(snapshot, 'province', 'administrative_division_level_1_name'),
    pick(snapshot, 'postalCode', 'postal', 'postal_code'),
  ].filter(Boolean).join(', ');
  return [primary, locality].filter(Boolean).map(clean);
}

function itemRows(raw: unknown): Array<Record<string, unknown>> {
  return Array.isArray(raw) ? raw.map(object) : [];
}

function itemQuantity(item: Record<string, unknown>): number {
  const raw = item.quantity ?? item.qty;
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : 1;
}

function totalWeight(items: Array<Record<string, unknown>>): number {
  return items.reduce((sum, item) => {
    const raw = item.weight;
    const grams = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, raw) : 0;
    return sum + (grams * itemQuantity(item));
  }, 0);
}

function drawCode39(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, height: number): void {
  const supported = clean(value).toUpperCase().split('').filter((char) => CODE39[char]).join('') || 'NO-AWB';
  const encoded = `*${supported}*`;
  const units = encoded.split('').reduce((sum, char) => {
    const pattern = CODE39[char] ?? CODE39['-']!;
    return sum + pattern.split('').reduce((n, unit) => n + (unit === 'w' ? 3 : 1), 0) + 1;
  }, 0) - 1;
  const narrow = width / units;
  let cursor = x;
  doc.save().fillColor('#111111');
  for (const char of encoded) {
    const pattern = CODE39[char] ?? CODE39['-']!;
    for (let i = 0; i < pattern.length; i += 1) {
      const unit = pattern[i] === 'w' ? 3 * narrow : narrow;
      if (i % 2 === 0) doc.rect(cursor, y, unit, height).fill();
      cursor += unit;
    }
    cursor += narrow;
  }
  doc.restore();
}

function drawText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  options: PDFKit.Mixins.TextOptions = {},
): void {
  doc.font('Helvetica').fontSize(fontSize).fillColor('#111111')
    .text(clean(text) || '—', x, y, { width, lineBreak: true, ellipsis: true, ...options });
}

function drawCell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  lines: string[],
  compact: boolean,
): void {
  const pad = compact ? 4 : 6;
  const titleSize = compact ? 5.5 : 6.5;
  const bodySize = compact ? 6.5 : 7.5;
  doc.rect(x, y, width, height).strokeColor('#111111').lineWidth(0.6).stroke();
  doc.font('Helvetica-Bold').fontSize(titleSize).fillColor('#111111')
    .text(title.toUpperCase(), x + pad, y + pad, { width: width - (pad * 2), lineBreak: false });
  drawText(doc, lines.filter(Boolean).join('\n'), x + pad, y + pad + titleSize + 3, width - (pad * 2), bodySize, {
    height: height - (pad * 2) - titleSize - 3,
  });
}

function drawCourierLogo(
  doc: PDFKit.PDFDocument,
  courierCode: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  compact: boolean,
): void {
  const code = courierCode.toLowerCase() as CourierLogoCode;
  const file = courierLogoFiles[code];
  if (!file) {
    doc.font('Helvetica-Bold').fontSize(compact ? 15 : 19).fillColor('#111111')
      .text(courierCode.toUpperCase() || 'COURIER', x, y, { width: maxWidth, lineBreak: false });
    return;
  }

  const image = (doc as PDFKit.PDFDocument & {
    openImage(source: string): { width: number; height: number };
  }).openImage(file);
  const background = courierLogoBackgrounds[code];
  const inset = background ? (compact ? 3 : 4) : 0;
  const scale = Math.min(
    (maxWidth - (inset * 2)) / image.width,
    (maxHeight - (inset * 2)) / image.height,
  );
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  const boxWidth = imageWidth + (inset * 2);
  const boxHeight = imageHeight + (inset * 2);
  const boxY = y + ((maxHeight - boxHeight) / 2);

  if (background) {
    doc.save().roundedRect(x, boxY, boxWidth, boxHeight, compact ? 2.5 : 3.5).fill(background).restore();
  }
  doc.image(file, x + inset, boxY + inset, { width: imageWidth, height: imageHeight });
}

function drawFulkrumaBrand(
  doc: PDFKit.PDFDocument,
  right: number,
  y: number,
  width: number,
  compact: boolean,
): void {
  const iconSize = compact ? 17 : 21;
  const wordmarkSize = compact ? 10 : 13;
  const taglineSize = compact ? 5.5 : 6.5;
  const gap = compact ? 4 : 5;
  const scale = iconSize / 32;

  doc.font('Gellix-SemiBold').fontSize(wordmarkSize);
  const wordmarkWidth = doc.widthOfString('Fulkruma');
  const totalWidth = iconSize + gap + wordmarkWidth;
  const startX = Math.max(right - width, right - totalWidth);

  doc.save();
  doc.roundedRect(startX, y, iconSize, iconSize, 8 * scale).fill('#F22F46');
  doc.roundedRect(startX + (8 * scale), y + (7 * scale), 16 * scale, 4.5 * scale, 1.25 * scale).fill('#FFFFFF');
  doc.roundedRect(startX + (8 * scale), y + (13.75 * scale), 11 * scale, 4.5 * scale, 1.25 * scale).fill('#FFFFFF');
  doc.roundedRect(startX + (8 * scale), y + (20.5 * scale), 4.5 * scale, 4.5 * scale, 1.25 * scale).fill('#FFFFFF');
  doc.restore();

  const textX = startX + iconSize + gap;
  doc.font('Gellix-SemiBold').fontSize(wordmarkSize).fillColor('#111111')
    .text('Fulkruma', textX, y - (compact ? 0.5 : 1), { width: wordmarkWidth, lineBreak: false });
  doc.font('Helvetica').fontSize(taglineSize).fillColor('#444444')
    .text('Forjio family', textX, y + (compact ? 10 : 13), { width: wordmarkWidth, lineBreak: false });
}

function drawAddressCell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  name: string,
  addressLines: string[],
  phone: string,
  compact: boolean,
): void {
  const pad = compact ? 4 : 6;
  const titleSize = compact ? 5.5 : 6.5;
  const nameSize = compact ? 7 : 8;
  const bodySize = compact ? 6.5 : 7.5;
  const nameY = y + pad + titleSize + 3;
  const dividerY = nameY + (compact ? 11 : 14);
  const bodyY = dividerY + (compact ? 4 : 5);
  const bodyLines = [...addressLines, phone].filter(Boolean);

  doc.rect(x, y, width, height).strokeColor('#111111').lineWidth(0.6).stroke();
  doc.font('Helvetica-Bold').fontSize(titleSize).fillColor('#111111')
    .text(title.toUpperCase(), x + pad, y + pad, { width: width - (pad * 2), lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(nameSize).fillColor('#111111')
    .text(clean(name) || '—', x + pad, nameY, {
      width: width - (pad * 2),
      height: dividerY - nameY,
      lineBreak: false,
      ellipsis: true,
    });
  doc.moveTo(x, dividerY).lineTo(x + width, dividerY).lineWidth(0.45).strokeColor('#555555').stroke();
  drawText(doc, bodyLines.join('\n'), x + pad, bodyY, width - (pad * 2), bodySize, {
    height: height - (bodyY - y) - pad,
  });
}

function drawLabel(
  doc: PDFKit.PDFDocument,
  shipment: LabelShipment,
  options: ShipmentLabelOptions,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const compact = width < (90 * PT_PER_MM);
  const pad = compact ? 7 : 10;
  const origin = object(shipment.originSnapshot);
  const destination = object(shipment.destinationSnapshot);
  const items = itemRows(shipment.items);
  const waybill = clean(shipment.waybillId ?? '');
  const courierCode = clean(shipment.courierCode).toLowerCase();
  const courier = courierCode.toUpperCase();
  const service = clean(shipment.courierServiceCode).toUpperCase();
  const reference = clean(shipment.externalRef ?? shipment.checkoutSessionId ?? shipment.id);
  const senderName = pick(origin, 'contactName', 'contact_name', 'name') || 'Sender';
  const senderPhone = pick(origin, 'contactPhone', 'contact_phone', 'phone');
  const recipientRaw = pick(destination, 'contactName', 'contact_name', 'name') || 'Recipient';
  const recipientName = options.maskRecipientName ? maskName(recipientRaw) : recipientRaw;
  const recipientPhone = pick(destination, 'contactPhone', 'contact_phone', 'phone');
  const quantity = items.reduce((sum, item) => sum + itemQuantity(item), 0);
  const weight = totalWeight(items);
  const contentX = x + pad;
  const contentW = width - (pad * 2);
  let cursorY = y + pad;

  doc.rect(x, y, width, height).strokeColor('#111111').lineWidth(1).stroke();
  drawCourierLogo(doc, courierCode, contentX, cursorY, contentW * 0.45, compact ? 19 : 24, compact);
  drawFulkrumaBrand(doc, contentX + contentW, cursorY, contentW * 0.5, compact);
  cursorY += compact ? 25 : 31;
  doc.moveTo(contentX, cursorY).lineTo(contentX + contentW, cursorY).lineWidth(1.2).stroke();
  cursorY += compact ? 5 : 7;

  const barcodeHeight = compact ? 28 : 42;
  drawCode39(doc, waybill, contentX + 3, cursorY, contentW - 6, barcodeHeight);
  cursorY += barcodeHeight + 3;
  doc.font('Helvetica-Bold').fontSize(compact ? 8 : 10).fillColor('#111111')
    .text(`Tracking number - ${waybill}`, contentX, cursorY, { width: contentW, align: 'center', lineBreak: false });
  cursorY += compact ? 13 : 17;

  const metaH = compact ? 36 : 45;
  const half = contentW / 2;
  drawCell(doc, contentX, cursorY, half, metaH, 'Shipment', [
    `${courier} ${service}`,
    `${quantity} item${quantity === 1 ? '' : 's'} · ${weight > 0 ? `${(weight / 1000).toFixed(weight % 1000 === 0 ? 0 : 1)} kg` : 'weight —'}`,
  ], compact);
  const costLines = [`Ref: ${reference}`];
  if (options.showShippingCost) costLines.push(`Shipping: ${formatMoney(shipment.price)}`);
  if (options.showInsurance && shipment.insured) costLines.push(`Insurance: ${formatMoney(shipment.insurance)}`);
  drawCell(doc, contentX + half, cursorY, half, metaH, 'Reference', costLines, compact);
  cursorY += metaH;

  const addressH = compact ? 64 : 82;
  drawAddressCell(
    doc,
    contentX,
    cursorY,
    half,
    addressH,
    'Sender',
    senderName,
    formatAddress(origin),
    options.showSenderPhone ? senderPhone : '',
    compact,
  );
  drawAddressCell(
    doc,
    contentX + half,
    cursorY,
    half,
    addressH,
    'Recipient',
    recipientName,
    formatAddress(destination),
    options.showRecipientPhone ? recipientPhone : '',
    compact,
  );
  cursorY += addressH + (compact ? 4 : 6);

  if (options.showItems && items.length > 0) {
    const available = Math.max(compact ? 37 : 55, (y + height - pad - 12) - cursorY);
    doc.rect(contentX, cursorY, contentW, available).lineWidth(0.6).stroke();
    doc.font('Helvetica-Bold').fontSize(compact ? 5.5 : 6.5).text('ITEMS', contentX + (compact ? 4 : 6), cursorY + (compact ? 4 : 6));
    const itemLines = items.slice(0, compact ? 3 : 5).map((item) => {
      const name = pick(item, 'name') || 'Item';
      const details: string[] = [];
      if (options.showItemSkus) {
        const sku = pick(item, 'sku', 'SKU');
        if (sku) details.push(`SKU ${sku}`);
      }
      if (options.showItemDescriptions) {
        const description = pick(item, 'description');
        if (description) details.push(description);
      }
      return `${itemQuantity(item)}× ${name}${details.length ? ` · ${details.join(' · ')}` : ''}`;
    });
    if (items.length > itemLines.length) itemLines.push(`+${items.length - itemLines.length} more item types`);
    drawText(doc, itemLines.join('\n'), contentX + (compact ? 4 : 6), cursorY + (compact ? 13 : 17), contentW - (compact ? 8 : 12), compact ? 6.3 : 7.3, {
      height: available - (compact ? 17 : 23),
    });
  }
}

export async function generateShipmentLabel(
  shipment: LabelShipment,
  overrides: Partial<ShipmentLabelOptions> = {},
): Promise<ShipmentLabelFile> {
  if (!shipment.waybillId?.trim()) throw new Error('Shipment has no AWB yet');
  const size = overrides.size ?? 'thermal-100x150';
  const options = { ...defaultShipmentLabelOptions(size), ...overrides, size };
  const [pageWidth, pageHeight] = sizePoints[size];
  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margin: 0,
    compress: true,
    info: {
      Title: `Shipping label ${shipment.waybillId}`,
      Author: 'Fulkruma',
      Subject: 'Shipment label',
      Keywords: 'shipment,label,resi,waybill',
    },
  });
  const chunks: Buffer[] = [];
  doc.registerFont('Gellix-SemiBold', GELLIX_SEMIBOLD);
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  if (size === 'a4') {
    const labelWidth = 100 * PT_PER_MM;
    const labelHeight = 150 * PT_PER_MM;
    drawLabel(doc, shipment, options, (pageWidth - labelWidth) / 2, 18 * PT_PER_MM, labelWidth, labelHeight);
  } else {
    drawLabel(doc, shipment, options, 0, 0, pageWidth, pageHeight);
  }
  doc.end();
  const pdf = await complete;
  const safeWaybill = shipment.waybillId.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return {
    fileName: `shipping-label-${safeWaybill}-${size}.pdf`,
    contentType: 'application/pdf',
    base64: pdf.toString('base64'),
    size,
    waybillId: shipment.waybillId,
  };
}
