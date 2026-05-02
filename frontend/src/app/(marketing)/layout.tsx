import type { ReactNode } from 'react';
import Link from 'next/link';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold"
            >
              F
            </span>
            <span className="text-base font-semibold tracking-tight">Fulkruma</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm md:flex">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition">
              Features
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition">
              Pricing
            </a>
            <a href="#integrations" className="text-muted-foreground hover:text-foreground transition">
              Integrations
            </a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition">
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-brand-600 transition"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>
      {children}
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <div className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold"
            >
              F
            </span>
            <span className="text-base font-semibold tracking-tight">Fulkruma</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Stock + shipping for Indonesian storefronts. Part of the Forjio family.
          </p>
        </div>
        <FooterCol
          heading="Product"
          links={[
            { href: '#features', label: 'Features' },
            { href: '#pricing', label: 'Pricing' },
            { href: '#integrations', label: 'Integrations' },
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
