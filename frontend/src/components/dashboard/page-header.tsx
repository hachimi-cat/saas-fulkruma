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
    // Phone: title, subtitle and each action stack — one per row, actions
    // full-width. sm+ restores the classic title-left/action-right line.
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 sm:flex-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex flex-col items-stretch gap-2 max-sm:[&>*]:justify-center sm:flex-row sm:items-center sm:shrink-0">
          {action}
        </div>
      )}
    </header>
  );
}
