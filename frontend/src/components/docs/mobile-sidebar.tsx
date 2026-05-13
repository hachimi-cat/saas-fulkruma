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
// Item styling mirrors the dashboard sidebar.
export function DocsMobileSidebar({ groups, currentHref }: DocsMobileSidebarProps) {
  const [open, setOpen] = useState(false);
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
            <nav className="grid gap-4 px-4 py-4 pb-12" aria-label="Documentation">
              {groups.map((g) => {
                const isOpen = expanded.has(g.heading);
                return (
                  <div key={g.heading}>
                    <button
                      type="button"
                      onClick={() => toggle(g.heading)}
                      className="flex w-full items-center justify-between px-2.5 pb-1.5 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/70 font-semibold">
                        {g.heading}
                      </span>
                      <ChevronRight
                        className={
                          'h-3 w-3 text-muted-foreground/70 transition-transform ' +
                          (isOpen ? 'rotate-90' : '')
                        }
                        aria-hidden
                      />
                    </button>
                    {isOpen && (
                      <ul className="grid gap-px">
                        {g.items.map((item) => {
                          const active = item.href === currentHref;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className={
                                  'flex items-center gap-2.5 rounded-lg py-[7px] px-2.5 text-[13.5px] transition-colors ' +
                                  (active
                                    ? 'bg-primary/10 text-primary font-semibold'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60')
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
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
