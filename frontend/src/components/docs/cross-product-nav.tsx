import Link from 'next/link';

// The Forjio family — these products share identity (Huudis), billing
// (Plugipay), and a docs aesthetic. We surface them in the docs header
// so users exploring Fulkruma can jump sideways into related products.
//
// `href` points at each product's marketing landing today. As each
// product ships its own /docs site, swap to <brand>.com/docs.
const PRODUCTS: { name: string; href: string; tagline: string }[] = [
  { name: 'Huudis', href: 'https://huudis.com', tagline: 'Identity' },
  { name: 'Plugipay', href: 'https://plugipay.com', tagline: 'Payments' },
  { name: 'Storlaunch', href: 'https://storlaunch.com', tagline: 'E-commerce' },
  { name: 'Fulkruma', href: '/', tagline: 'Fulfilment' },
  { name: 'Ripllo', href: 'https://ripllo.com', tagline: 'Marketing' },
  { name: 'LinkSnap', href: 'https://linksnap.com', tagline: 'Short URLs' },
  { name: 'Pawpado', href: 'https://pawpado.com', tagline: 'GPU streaming' },
];

export function CrossProductNav() {
  return (
    <div className="border-b border-border bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2">
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground mr-2">
            Forjio
          </span>
          {PRODUCTS.map((p) => {
            const isCurrent = p.name === 'Fulkruma';
            return (
              <Link
                key={p.name}
                href={p.href}
                className={
                  'shrink-0 rounded px-2 py-1 transition ' +
                  (isCurrent
                    ? 'bg-background font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground')
                }
                aria-current={isCurrent ? 'page' : undefined}
              >
                {p.name}
                <span className="ml-1.5 text-[10px] text-muted-foreground/60">{p.tagline}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
