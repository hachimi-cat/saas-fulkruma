'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronRight } from 'lucide-react';

interface DocItem {
  href: string;
  title: string;
}

interface DocGroup {
  heading: string;
  items: DocItem[];
}

interface DocsMobileSidebarProps {
  groups: DocGroup[];
  currentHref: string;
}

// Mobile-only drawer triggered by the hamburger icon in the docs
// header. Closes when a link is clicked or the user hits Escape.
export function DocsMobileSidebar({ groups, currentHref }: DocsMobileSidebarProps) {
  const [open, setOpen] = useState(false);
  // Collapsible groups inside the drawer, mirroring desktop sidebar
  // behavior. Initially: only the group containing the current page
  // is expanded; others collapsed so the drawer fits more on screen.
  const initialExpanded = () => {
    const set = new Set<string>();
    for (const g of groups) {
      if (g.items.some((i) => i.href === currentHref)) set.add(g.heading);
    }
    return set;
  };
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);
  const toggle = (heading: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(heading)) next.delete(heading);
      else next.add(heading);
      return next;
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="inline-flex items-center justify-center rounded-md border border-border bg-background w-9 h-9 hover:bg-muted"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <aside
            className="fixed top-0 right-0 h-full w-[85vw] max-w-[320px] overflow-y-auto bg-background border-l border-border shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Documentation navigation"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-4 py-3">
              <span className="text-sm font-semibold">Documentation</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="inline-flex items-center justify-center rounded-md w-8 h-8 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1 px-4 py-4 pb-12">
              {groups.map((g) => {
                const isOpen = expanded.has(g.heading);
                return (
                  <div key={g.heading}>
                    <button
                      type="button"
                      onClick={() => toggle(g.heading)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 -mx-3 text-left hover:bg-muted/60"
                      aria-expanded={isOpen}
                    >
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                        {g.heading}
                      </span>
                      <ChevronRight
                        className={
                          'h-3.5 w-3.5 text-muted-foreground transition-transform ' +
                          (isOpen ? 'rotate-90' : '')
                        }
                        aria-hidden
                      />
                    </button>
                    {isOpen && (
                      <ul className="space-y-0.5 mt-1 mb-3">
                        {g.items.map((item) => {
                          const active = item.href === currentHref;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className={
                                  'block py-2 px-3 -mx-3 text-sm rounded-lg ' +
                                  (active
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted')
                                }
                              >
                                {item.title}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
