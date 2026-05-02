import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-header items-center justify-between border-b border-header-border bg-header px-6">
          <div className="text-sm text-muted-foreground">
            <span className="font-mono text-[11px] uppercase tracking-wider">Fulkruma · stock + shipping</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden md:inline text-muted-foreground">Workspace</span>
            <span className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium">
              dev
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
