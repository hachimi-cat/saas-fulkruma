import type { ChatActionOut, ProductAgentProfile } from '@forjio/catentio-embed';

/**
 * What the Fulkruma agent may plan against — the product half of the
 * @forjio/catentio-embed contract.
 *
 * Scope decision: the setup surfaces — `warehouses` (where stock lives)
 * and `products` (the catalog's shipping metadata). Both are things a
 * merchant types in once and expands over time.
 *
 * Deliberately out of scope AND refused at the auth layer: /stock and
 * stock movements (the inventory ledger), /shipments and /deliveries
 * (in-flight orders and courier bookings), /licenses (customer
 * entitlements), /shipping-credits (money), /addresses (buyer PII).
 *
 * Variants are excluded too, and that is a considered omission rather
 * than an oversight: a variant carries `priceCents`, and the family has
 * a known inconsistency about whether that column holds cents or whole
 * rupiah (storlaunch's sync writes whole rupiah straight into it). Until
 * that is settled, the agent has no business proposing a number into it.
 */

/** Per-product delegation token prefix — a leaked token names its
 *  origin. */
export const FULKRUMA_DELEGATION_PREFIX = 'fkdt_';

export interface FulkrumaLimits {
  plan: string;
}

export const FULKRUMA_PROFILE: ProductAgentProfile<FulkrumaLimits> = {
  productName: 'Fulkruma',
  resources: {
    warehouses: {
      label: 'warehouse',
      createRequired: ['name'],
      fields: [
        { key: 'name', type: 'string', create: true, edit: true, description: 'warehouse name (≤120 chars)' },
        { key: 'address', type: 'string', create: true, edit: true, nullable: true, description: 'street address, or null' },
        { key: 'city', type: 'string', create: true, edit: true, nullable: true, description: 'city, or null' },
        { key: 'postal', type: 'string', create: true, edit: true, nullable: true, description: 'postal code, or null' },
        { key: 'phone', type: 'string', create: true, edit: true, nullable: true, description: 'contact phone, or null' },
      ],
    },
    products: {
      label: 'product',
      createRequired: ['name'],
      fields: [
        { key: 'name', type: 'string', create: true, edit: true, description: 'product name (≤200 chars)' },
        { key: 'sku', type: 'string', create: true, edit: true, description: 'merchant-defined external SKU' },
        { key: 'description', type: 'string', create: true, edit: true, description: 'what the item is' },
        { key: 'type', type: 'string', create: true, edit: true, description: "'physical' | 'digital' | 'license'" },
        { key: 'weight', type: 'number', create: true, edit: true, description: 'shipping weight in GRAMS (physical only)' },
        { key: 'length', type: 'number', create: true, edit: true, description: 'length in CM (physical only)' },
        { key: 'width', type: 'number', create: true, edit: true, description: 'width in CM (physical only)' },
        { key: 'height', type: 'number', create: true, edit: true, description: 'height in CM (physical only)' },
      ],
    },
  },
  scopeSummary: "the merchant's warehouses, products, stock, shipments, or licenses",
  multiStepExample: 'add a warehouse AND the products you ship from it',
  writablesSummary: 'warehouses and product records',
  endpointsLine:
    '- Key endpoints: POST /api/v1/warehouses (body fields below) · PATCH /api/v1/warehouses/{id} · DELETE /api/v1/warehouses/{id} · POST /api/v1/products · PATCH /api/v1/products/{id} · DELETE /api/v1/products/{id} · GET /api/v1/warehouses, /api/v1/products.',
  extraNotes: [
    'Dimensions are integers in fixed units: weight in GRAMS, length/width/height in CENTIMETRES. They only mean anything for type "physical", and the courier rate quote is computed from them — a wrong unit here becomes a wrong shipping price, so never guess one. Ask if the user has not said.',
    'A product that carries an externalSource (e.g. "storlaunch") is MIRRORED from another Forjio product. Editing it here will be overwritten by the next sync — say so and point the user at the product it came from instead of changing it.',
    'You cannot set prices or stock levels. Variants, stock, shipments, deliveries, licenses and shipping credits are all refused before your request reaches them; propose nothing there.',
  ],
  bulkExample: 'add these 12 products with their shipping weights',
  untrustedExamples: 'product names and descriptions',
  gatherExamples: 'the existing warehouses and their ids, the product you are editing',
  executeSummaryExamples: 'the new warehouse and its city, the product and its shipping weight, what actually changed',
  plan: {
    lookupSummary: 'warehouses and products',
  },
};

export type FulkrumaChatAction = ChatActionOut;
