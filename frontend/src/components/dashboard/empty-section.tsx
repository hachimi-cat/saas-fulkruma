import type { LucideIcon } from 'lucide-react';

export function EmptySection({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon size={18} strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </header>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
        <p className="text-sm font-medium">Nothing to show yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Backend routes and data will land in Phase E.
        </p>
      </div>
    </div>
  );
}
