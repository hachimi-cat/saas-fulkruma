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

  // SDKs
  { slug: 'sdk', title: 'Overview', group: 'SDKs', href: '/docs/sdk' },
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
