import { LogoMark } from '@/components/brand/logo';

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <div className="inline-flex items-center gap-2">
            <LogoMark size={26} />
            <span className="text-base font-semibold tracking-tight">Fulkruma</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Stock + shipping for Indonesian storefronts. Part of the Forjio family.
          </p>
        </div>
        <FooterCol
          heading="Product"
          links={[
            { href: '/#features', label: 'Features' },
            { href: '/#pricing', label: 'Pricing' },
            { href: '/#integrations', label: 'Integrations' },
            { href: '/login', label: 'Sign in' },
          ]}
        />
        <FooterCol
          heading="Forjio family"
          links={[
            { href: 'https://huudis.com', label: 'Huudis · auth' },
            { href: 'https://plugipay.com', label: 'Plugipay · payments' },
            { href: 'https://storlaunch.com', label: 'Storlaunch · storefront' },
          ]}
        />
        <FooterCol
          heading="Legal"
          links={[
            { href: '/privacy', label: 'Privacy' },
            { href: '/terms', label: 'Terms' },
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Fulkruma. Part of the Forjio commerce family.</span>
          <span className="font-mono">v0.1 · dev</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ heading, links }: { heading: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {heading}
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="text-foreground hover:text-brand-600 transition">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
