'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface DocItem {
  href: string;
  title: string;
}

interface DocGroup {
  heading: string;
  items: DocItem[];
}

interface DocsSidebarProps {
  groups: DocGroup[];
  currentHref: string;
}

const STORAGE_KEY = 'docs-sidebar-open-groups';

// Fixed-height scrollable sidebar with collapsible groups. The group
// containing the current page is always open on first render; user
// toggles are persisted to localStorage so navigating between pages
// doesn't reset the layout.
export function DocsSidebar({ groups, currentHref }: DocsSidebarProps) {
  // Initial open set: only the group with the current page. Hydration-
  // safe (server renders the same default; client effect can widen).
  const initialOpen = () => {
    const set = new Set<string>();
    for (const g of groups) {
      if (g.items.some((i) => i.href === currentHref)) {
        set.add(g.heading);
      }
    }
    return set;
  };
  const [open, setOpen] = useState<Set<string>>(initialOpen);
  const [hydrated, setHydrated] = useState(false);

  // Restore persisted open set after hydration; merge with the current
  // group so the visible page is always reachable.
  useEffect(() => {
    setHydrated(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        const next = new Set(arr);
        for (const g of groups) {
          if (g.items.some((i) => i.href === currentHref)) next.add(g.heading);
        }
        setOpen(next);
      }
    } catch {
      /* ignore corrupted storage */
    }
  }, [currentHref, groups]);

  // Persist on change (post-hydration only).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(open)));
    } catch {
      /* ignore */
    }
  }, [open, hydrated]);

  function toggle(heading: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(heading)) next.delete(heading);
      else next.add(heading);
      return next;
    });
  }

  return (
    <nav className="space-y-1 text-sm" aria-label="Docs sidebar">
      {groups.map((g) => {
        const isOpen = open.has(g.heading);
        const groupHasActive = g.items.some((i) => i.href === currentHref);
        return (
          <div key={g.heading}>
            <button
              type="button"
              onClick={() => toggle(g.heading)}
              className={
                'group flex w-full items-center justify-between rounded-lg px-3 py-2 -mx-3 text-left transition ' +
                'hover:bg-muted/60'
              }
              aria-expanded={isOpen}
            >
              <span
                className={
                  'font-mono text-[11px] uppercase tracking-wide font-semibold ' +
                  (groupHasActive
                    ? 'text-foreground'
                    : 'text-muted-foreground group-hover:text-foreground')
                }
              >
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
    </nav>
  );
}
