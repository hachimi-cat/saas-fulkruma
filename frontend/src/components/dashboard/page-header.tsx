import type { ReactNode } from 'react';

/**
 * Shared dashboard page header — single source of truth for page-title
 * styling so every portal page matches (Gellix display title, size,
 * spacing). Title + optional description on the left, optional action
 * cluster on the right.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
