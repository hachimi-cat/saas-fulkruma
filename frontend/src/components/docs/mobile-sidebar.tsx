'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

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
            <div className="space-y-6 px-4 py-4 pb-12">
              {groups.map((g) => (
                <div key={g.heading}>
                  <h5 className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                    {g.heading}
                  </h5>
                  <ul className="space-y-0.5">
                    {g.items.map((item) => {
                      const active = item.href === currentHref;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={
                              'block py-1.5 px-2 -mx-2 text-sm rounded-md ' +
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
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
