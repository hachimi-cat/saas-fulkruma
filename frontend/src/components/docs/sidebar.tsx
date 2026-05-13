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

// Fixed-height scrollable sidebar with collapsible groups. Styling
// mirrors the dashboard sidebar (components/layout/sidebar.tsx) so
// docs and portal feel like one product.
export function DocsSidebar({ groups, currentHref }: DocsSidebarProps) {
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
    <nav className="grid gap-4" aria-label="Docs sidebar">
      {groups.map((g) => {
        const isOpen = open.has(g.heading);
        const groupHasActive = g.items.some((i) => i.href === currentHref);
        return (
          <div key={g.heading}>
            <button
              type="button"
              onClick={() => toggle(g.heading)}
              className="group flex w-full items-center justify-between px-2.5 pb-1.5 text-left"
              aria-expanded={isOpen}
            >
              <span
                className={
                  'font-mono text-[10.5px] uppercase tracking-[0.12em] font-semibold ' +
                  (groupHasActive
                    ? 'text-foreground'
                    : 'text-muted-foreground/70 group-hover:text-foreground')
                }
              >
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
  );
}
