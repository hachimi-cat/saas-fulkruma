import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import matter from 'gray-matter';

const COPY_ROOT = (() => {
  const candidates = [
    process.env.COPY_ROOT,
    path.resolve(process.cwd(), '../copy'),
    path.resolve(process.cwd(), '../../copy'),
  ].filter((p): p is string => !!p);
  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, 'docs'))) return c;
    } catch {}
  }
  return candidates[candidates.length - 1] ?? path.resolve(process.cwd(), '../../copy');
})();

export type DocMeta = {
  slug: string;
  title: string;
  group?: string;
  href: string;
};

export const DOC_NAV: DocMeta[] = [
  // Getting started
  { slug: '', title: 'Introduction', group: 'Getting started', href: '/docs' },
  { slug: 'quickstart', title: 'Quickstart', group: 'Getting started', href: '/docs/quickstart' },
  { slug: 'installation', title: 'Installation', group: 'Getting started', href: '/docs/installation' },

  // Core
  { slug: 'concepts', title: 'Concepts', group: 'Core concepts', href: '/docs/concepts' },

  // Authentication
  { slug: 'auth/overview', title: 'Overview', group: 'Authentication', href: '/docs/auth/overview' },
  { slug: 'auth/signin', title: 'Sign in', group: 'Authentication', href: '/docs/auth/signin' },
  { slug: 'auth/forgot-password', title: 'Forgot password', group: 'Authentication', href: '/docs/auth/forgot-password' },

  // Portal
  { slug: 'portal', title: 'Tour', group: 'Portal', href: '/docs/portal' },
  { slug: 'portal/warehouses', title: 'Warehouses', group: 'Portal', href: '/docs/portal/warehouses' },
  { slug: 'portal/products', title: 'Products & stock', group: 'Portal', href: '/docs/portal/products' },
  { slug: 'portal/shipments', title: 'Shipments', group: 'Portal', href: '/docs/portal/shipments' },

  // API
  { slug: 'api', title: 'Overview', group: 'API reference', href: '/docs/api' },
  { slug: 'api/authentication', title: 'Authentication', group: 'API reference', href: '/docs/api/authentication' },

  // API resources
  { slug: 'api/resources', title: 'Overview', group: 'API resources', href: '/docs/api/resources' },
  { slug: 'api/resources/warehouses', title: 'Warehouses', group: 'API resources', href: '/docs/api/resources/warehouses' },
  { slug: 'api/resources/products', title: 'Products', group: 'API resources', href: '/docs/api/resources/products' },
  { slug: 'api/resources/stock', title: 'Stock', group: 'API resources', href: '/docs/api/resources/stock' },
  { slug: 'api/resources/shipments', title: 'Shipments', group: 'API resources', href: '/docs/api/resources/shipments' },
  { slug: 'api/resources/shipping', title: 'Shipping', group: 'API resources', href: '/docs/api/resources/shipping' },
  { slug: 'api/resources/deliveries', title: 'Deliveries', group: 'API resources', href: '/docs/api/resources/deliveries' },
  { slug: 'api/resources/licenses', title: 'Licenses', group: 'API resources', href: '/docs/api/resources/licenses' },
  { slug: 'api/resources/addresses', title: 'Addresses', group: 'API resources', href: '/docs/api/resources/addresses' },
  { slug: 'api/resources/api-keys', title: 'API keys', group: 'API resources', href: '/docs/api/resources/api-keys' },
  { slug: 'api/resources/webhooks', title: 'Webhooks', group: 'API resources', href: '/docs/api/resources/webhooks' },
  { slug: 'api/resources/audit-log', title: 'Audit log', group: 'API resources', href: '/docs/api/resources/audit-log' },
  { slug: 'api/resources/billing', title: 'Billing', group: 'API resources', href: '/docs/api/resources/billing' },
  { slug: 'api/resources/integrations', title: 'Integrations', group: 'API resources', href: '/docs/api/resources/integrations' },

  // Webhook events
  { slug: 'api/webhooks/events/fulkruma.product.created', title: 'product.created', group: 'Webhook events', href: '/docs/api/webhooks/events/fulkruma.product.created' },
  { slug: 'api/webhooks/events/fulkruma.stock.adjusted', title: 'stock.adjusted', group: 'Webhook events', href: '/docs/api/webhooks/events/fulkruma.stock.adjusted' },
  { slug: 'api/webhooks/events/fulkruma.shipment.created', title: 'shipment.created', group: 'Webhook events', href: '/docs/api/webhooks/events/fulkruma.shipment.created' },
  { slug: 'api/webhooks/events/fulkruma.delivery.created', title: 'delivery.created', group: 'Webhook events', href: '/docs/api/webhooks/events/fulkruma.delivery.created' },
  { slug: 'api/webhooks/events/fulkruma.license.issued', title: 'license.issued', group: 'Webhook events', href: '/docs/api/webhooks/events/fulkruma.license.issued' },
  { slug: 'api/webhooks/events/fulkruma.license.revoked', title: 'license.revoked', group: 'Webhook events', href: '/docs/api/webhooks/events/fulkruma.license.revoked' },

  // SDKs
  { slug: 'sdk', title: 'Overview', group: 'SDKs', href: '/docs/sdk' },

  // Node.js SDK
  { slug: 'sdk/node/resources/warehouses', title: 'Warehouses', group: 'Node.js SDK', href: '/docs/sdk/node/resources/warehouses' },
  { slug: 'sdk/node/resources/products', title: 'Products', group: 'Node.js SDK', href: '/docs/sdk/node/resources/products' },
  { slug: 'sdk/node/resources/stock', title: 'Stock', group: 'Node.js SDK', href: '/docs/sdk/node/resources/stock' },
  { slug: 'sdk/node/resources/shipments', title: 'Shipments', group: 'Node.js SDK', href: '/docs/sdk/node/resources/shipments' },
  { slug: 'sdk/node/resources/shipping', title: 'Shipping', group: 'Node.js SDK', href: '/docs/sdk/node/resources/shipping' },
  { slug: 'sdk/node/resources/deliveries', title: 'Deliveries', group: 'Node.js SDK', href: '/docs/sdk/node/resources/deliveries' },
  { slug: 'sdk/node/resources/licenses', title: 'Licenses', group: 'Node.js SDK', href: '/docs/sdk/node/resources/licenses' },
  { slug: 'sdk/node/resources/addresses', title: 'Addresses', group: 'Node.js SDK', href: '/docs/sdk/node/resources/addresses' },
  { slug: 'sdk/node/resources/api-keys', title: 'API keys', group: 'Node.js SDK', href: '/docs/sdk/node/resources/api-keys' },
  { slug: 'sdk/node/resources/webhooks', title: 'Webhooks', group: 'Node.js SDK', href: '/docs/sdk/node/resources/webhooks' },
  { slug: 'sdk/node/resources/audit-log', title: 'Audit log', group: 'Node.js SDK', href: '/docs/sdk/node/resources/audit-log' },
  { slug: 'sdk/node/resources/billing', title: 'Billing', group: 'Node.js SDK', href: '/docs/sdk/node/resources/billing' },
  { slug: 'sdk/node/resources/integrations', title: 'Integrations', group: 'Node.js SDK', href: '/docs/sdk/node/resources/integrations' },

  // Python SDK
  { slug: 'sdk/python/resources/warehouses', title: 'Warehouses', group: 'Python SDK', href: '/docs/sdk/python/resources/warehouses' },
  { slug: 'sdk/python/resources/products', title: 'Products', group: 'Python SDK', href: '/docs/sdk/python/resources/products' },
  { slug: 'sdk/python/resources/stock', title: 'Stock', group: 'Python SDK', href: '/docs/sdk/python/resources/stock' },
  { slug: 'sdk/python/resources/shipments', title: 'Shipments', group: 'Python SDK', href: '/docs/sdk/python/resources/shipments' },
  { slug: 'sdk/python/resources/shipping', title: 'Shipping', group: 'Python SDK', href: '/docs/sdk/python/resources/shipping' },
  { slug: 'sdk/python/resources/deliveries', title: 'Deliveries', group: 'Python SDK', href: '/docs/sdk/python/resources/deliveries' },
  { slug: 'sdk/python/resources/licenses', title: 'Licenses', group: 'Python SDK', href: '/docs/sdk/python/resources/licenses' },
  { slug: 'sdk/python/resources/addresses', title: 'Addresses', group: 'Python SDK', href: '/docs/sdk/python/resources/addresses' },
  { slug: 'sdk/python/resources/api-keys', title: 'API keys', group: 'Python SDK', href: '/docs/sdk/python/resources/api-keys' },
  { slug: 'sdk/python/resources/webhooks', title: 'Webhooks', group: 'Python SDK', href: '/docs/sdk/python/resources/webhooks' },
  { slug: 'sdk/python/resources/audit-log', title: 'Audit log', group: 'Python SDK', href: '/docs/sdk/python/resources/audit-log' },
  { slug: 'sdk/python/resources/billing', title: 'Billing', group: 'Python SDK', href: '/docs/sdk/python/resources/billing' },
  { slug: 'sdk/python/resources/integrations', title: 'Integrations', group: 'Python SDK', href: '/docs/sdk/python/resources/integrations' },

  // Go SDK
  { slug: 'sdk/go/resources/warehouses', title: 'Warehouses', group: 'Go SDK', href: '/docs/sdk/go/resources/warehouses' },
  { slug: 'sdk/go/resources/products', title: 'Products', group: 'Go SDK', href: '/docs/sdk/go/resources/products' },
  { slug: 'sdk/go/resources/stock', title: 'Stock', group: 'Go SDK', href: '/docs/sdk/go/resources/stock' },
  { slug: 'sdk/go/resources/shipments', title: 'Shipments', group: 'Go SDK', href: '/docs/sdk/go/resources/shipments' },
  { slug: 'sdk/go/resources/shipping', title: 'Shipping', group: 'Go SDK', href: '/docs/sdk/go/resources/shipping' },
  { slug: 'sdk/go/resources/deliveries', title: 'Deliveries', group: 'Go SDK', href: '/docs/sdk/go/resources/deliveries' },
  { slug: 'sdk/go/resources/licenses', title: 'Licenses', group: 'Go SDK', href: '/docs/sdk/go/resources/licenses' },
  { slug: 'sdk/go/resources/addresses', title: 'Addresses', group: 'Go SDK', href: '/docs/sdk/go/resources/addresses' },
  { slug: 'sdk/go/resources/api-keys', title: 'API keys', group: 'Go SDK', href: '/docs/sdk/go/resources/api-keys' },
  { slug: 'sdk/go/resources/webhooks', title: 'Webhooks', group: 'Go SDK', href: '/docs/sdk/go/resources/webhooks' },
  { slug: 'sdk/go/resources/audit-log', title: 'Audit log', group: 'Go SDK', href: '/docs/sdk/go/resources/audit-log' },
  { slug: 'sdk/go/resources/billing', title: 'Billing', group: 'Go SDK', href: '/docs/sdk/go/resources/billing' },
  { slug: 'sdk/go/resources/integrations', title: 'Integrations', group: 'Go SDK', href: '/docs/sdk/go/resources/integrations' },
];

export function docsGroups(): Array<{ heading: string; items: DocMeta[] }> {
  const groups = new Map<string, DocMeta[]>();
  for (const d of DOC_NAV) {
    const g = d.group ?? 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(d);
  }
  return Array.from(groups.entries()).map(([heading, items]) => ({ heading, items }));
}

// ─── Search index ─────────────────────────────────────────────────────
//
// Build-time scan of every doc page producing a flat index for the
// client-side search component. Each entry has the doc's title, group,
// href, and a body snippet for full-text matching.
//
// Computed once per build via the docs page's server component (which
// then hands the index to the client).

export interface SearchEntry {
  href: string;
  title: string;
  group: string;
  body: string;
}

export function buildSearchIndex(): SearchEntry[] {
  return DOC_NAV.map((nav) => {
    const { content } = readDocRaw(nav.slug);
    // Strip markdown syntax for plain-text matching.
    const body = content
      .replace(/```[\s\S]*?```/g, ' ')        // fenced code
      .replace(/`[^`]+`/g, ' ')                // inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
      .replace(/[#*_>|-]+/g, ' ')              // markdown punctuation
      .replace(/\s+/g, ' ')                    // collapse whitespace
      .trim()
      .slice(0, 4000);                          // cap per-entry size
    return {
      href: nav.href,
      title: nav.title,
      group: nav.group ?? 'Other',
      body,
    };
  });
}

function readDocRaw(slug: string | undefined): { content: string } {
  const cleanSlug = (slug ?? '').replace(/^\/+|\/+$/g, '');
  const rel = cleanSlug === '' ? 'index' : cleanSlug;
  const candidates = [
    path.join(COPY_ROOT, 'docs', `${rel}.md`),
    path.join(COPY_ROOT, 'docs', rel, 'index.md'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const raw = fs.readFileSync(c, 'utf8');
      return { content: matter(raw).content };
    }
  }
  return { content: '' };
}

export function readDoc(slug: string | undefined): { html: string; title: string; meta: DocMeta | null } {
  const cleanSlug = (slug ?? '').replace(/^\/+|\/+$/g, '');
  const rel = cleanSlug === '' ? 'index' : cleanSlug;
  const candidates = [
    path.join(COPY_ROOT, 'docs', `${rel}.md`),
    path.join(COPY_ROOT, 'docs', rel, 'index.md'),
  ];
  let filepath: string | null = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      filepath = c;
      break;
    }
  }
  if (!filepath) {
    return {
      html: `<p>Doc not found: <code>${cleanSlug}</code></p>`,
      title: 'Not found',
      meta: null,
    };
  }
  const raw = fs.readFileSync(filepath, 'utf8');
  const parsed = matter(raw);
  const content = parsed.content;
  const frontTitle = (parsed.data?.title as string | undefined) ?? extractFirstHeading(content) ?? cleanSlug;
  const html = marked.parse(content, { async: false }) as string;
  const meta = DOC_NAV.find((d) => d.slug === cleanSlug) ?? null;
  return { html, title: frontTitle, meta };
}

function extractFirstHeading(md: string): string | null {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}
