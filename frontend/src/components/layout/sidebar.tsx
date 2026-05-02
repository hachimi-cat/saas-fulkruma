'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { dashboardNav } from './nav-config';
import { LogoMark } from '@/components/brand/logo';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-sidebar shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <Link
        href="/dashboard"
        className="flex h-header items-center gap-2 border-b border-sidebar-border px-5 transition hover:bg-sidebar-accent/40"
      >
        <LogoMark size={26} />
        <span className="text-base font-semibold tracking-tight text-foreground">Fulkruma</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4 text-sm">
        {dashboardNav.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <ul className="mt-1 space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors ${
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                      }`}
                    >
                      <Icon size={16} strokeWidth={2} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-muted-foreground">
        <p>Part of the Forjio family</p>
        <p className="mt-1 font-mono text-[10px]">Auth via Huudis</p>
      </div>
    </aside>
  );
}
