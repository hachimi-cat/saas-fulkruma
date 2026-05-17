import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Changelog',
  description: "What's new in Fulkruma. Product updates, improvements, and fixes.",
};

const releases: Array<{ version: string; date: string; title: string; changes: string[] }> = [
  {
    version: 'v0.1.0',
    date: '8 May 2026',
    title: 'Initial launch',
    changes: [
      'Multi-warehouse stock management with append-only movement ledger.',
      'Soft-hold reservations integrated with Plugipay payment events.',
      'Biteship shipping adapter — JNE, SiCepat, ID Express, J&T, Anteraja, Pos, Lion Parcel, Ninja Xpress.',
      'Delivery tracking webhooks streamed to buyer-facing pages.',
      'License key issuance + activation tracking for digital products.',
      'CLI (`@forjio/fulkruma-cli`) for warehouses, stock, and shipments.',
      'Node, Python, and Go SDKs published to npm / PyPI / pkg.go.dev.',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <h1 className="text-4xl font-bold tracking-tight">Changelog</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Product updates, improvements, and fixes.
      </p>

      <div className="mt-12 space-y-12">
        {releases.map((release) => (
          <article key={release.version} className="relative border-l-2 border-border pl-8">
            <div className="absolute -left-[10px] top-0 h-5 w-5 rounded-full border-2 border-primary bg-background" />
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {release.version} · {release.date}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{release.title}</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {release.changes.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
