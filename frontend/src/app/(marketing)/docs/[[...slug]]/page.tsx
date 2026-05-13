import Link from 'next/link';
import { readDoc, docsGroups, buildSearchIndex } from '@/lib/markdown';
import { DocsSearch } from '@/components/docs/search';
import { CrossProductNav } from '@/components/docs/cross-product-nav';
import { DocsMobileSidebar } from '@/components/docs/mobile-sidebar';
import { DocsSidebar } from '@/components/docs/sidebar';

type Params = { slug?: string[] };

export default async function DocsPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const slug = (p.slug ?? []).join('/');
  const { html, title } = readDoc(slug);
  const groups = docsGroups();
  const searchIndex = buildSearchIndex();
  const currentHref = slug === '' ? '/docs' : `/docs/${slug}`;

  return (
    <>
      <CrossProductNav />

      {/* Docs header — search + mobile sidebar trigger */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <Link
            href="/docs"
            className="text-sm font-semibold whitespace-nowrap hover:text-primary"
          >
            Fulkruma Docs
          </Link>
          <div className="flex-1 flex justify-center">
            <DocsSearch index={searchIndex} />
          </div>
          <div className="lg:hidden">
            <DocsMobileSidebar groups={groups} currentHref={currentHref} />
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-8">
          {/* Sidebar — fixed-height, scrollable, collapsible. Hidden on
              mobile (use drawer trigger in the header). */}
          <aside className="hidden lg:block lg:sticky lg:top-[57px] lg:self-start lg:h-[calc(100vh-57px)] lg:overflow-y-auto pr-2 pb-6 pt-2">
            <DocsSidebar groups={groups} currentHref={currentHref} />
          </aside>

          {/* Main */}
          <article className="min-w-0">
            <nav className="text-xs text-muted-foreground mb-4">
              <Link href="/docs" className="hover:text-foreground">
                Docs
              </Link>
              {slug && (
                <>
                  <span className="mx-1.5 text-muted-foreground/50">/</span>
                  <span className="text-foreground">{title}</span>
                </>
              )}
            </nav>
            <div
              className="docs-prose prose-docs"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </article>
        </div>

        <style>{`
          .docs-prose { color: hsl(var(--foreground)); font-size: 15px; line-height: 1.65; max-width: 72ch; }
          .docs-prose h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 18px; line-height: 1.15; }
          .docs-prose h2 { font-size: 22px; font-weight: 700; letter-spacing: -0.015em; margin: 36px 0 14px; line-height: 1.2; border-top: 1px solid hsl(var(--border)); padding-top: 26px; }
          .docs-prose h2:first-of-type { border-top: none; padding-top: 0; }
          .docs-prose h3 { font-size: 17px; font-weight: 600; margin: 26px 0 10px; }
          .docs-prose h4 { font-size: 14px; font-weight: 600; margin: 18px 0 8px; color: hsl(var(--muted-foreground)); font-family: var(--font-jetbrains-mono), monospace; letter-spacing: 0.02em; text-transform: uppercase; }
          .docs-prose p { margin: 0 0 14px; }
          .docs-prose a { color: hsl(var(--primary)); text-decoration: underline; text-underline-offset: 3px; }
          .docs-prose code { background: hsl(var(--muted)); padding: 2px 6px; border-radius: 4px; font-size: 12.5px; font-family: var(--font-jetbrains-mono), monospace; }
          .docs-prose pre { background: #0C0A09; color: #A7F3D0; border-radius: 8px; padding: 16px 18px; margin: 14px 0; overflow-x: auto; font-size: 12.5px; line-height: 1.7; }
          .docs-prose pre code { background: transparent; color: inherit; padding: 0; font-size: inherit; }
          .docs-prose ul, .docs-prose ol { margin: 0 0 14px; padding-left: 1.4em; }
          .docs-prose li { margin: 6px 0; }
          .docs-prose blockquote { border-left: 3px solid hsl(var(--primary)); padding-left: 14px; margin: 14px 0; color: hsl(var(--muted-foreground)); background: hsl(var(--muted) / 0.4); border-radius: 0 6px 6px 0; padding: 10px 14px; }
          .docs-prose blockquote.callout-tip { border-left-color: hsl(142 76% 36%); background: hsl(142 76% 36% / 0.08); }
          .docs-prose blockquote.callout-note { border-left-color: hsl(217 91% 60%); background: hsl(217 91% 60% / 0.08); }
          .docs-prose blockquote.callout-warn { border-left-color: hsl(38 92% 50%); background: hsl(38 92% 50% / 0.10); }
          .docs-prose hr { border: 0; border-top: 1px solid hsl(var(--border)); margin: 28px 0; }
          .docs-prose table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
          .docs-prose th, .docs-prose td { border: 1px solid hsl(var(--border)); padding: 8px 12px; text-align: left; }
          .docs-prose th { background: hsl(var(--muted)); font-weight: 600; }
          .docs-prose strong { font-weight: 600; color: hsl(var(--foreground)); }
        `}</style>
      </main>
    </>
  );
}
