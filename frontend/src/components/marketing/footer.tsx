import { LogoMark } from '@/components/brand/logo';
import { MapPin, Phone, Mail } from 'lucide-react';

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
            { href: '/refund', label: 'Refund' },
            { href: '/contact', label: 'Contact' },
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-6 text-xs text-muted-foreground sm:grid-cols-3">
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">PT Forjio Teknologi Indonesia</p>
            <p className="flex items-start gap-2">
              <MapPin size={13} className="mt-0.5 shrink-0" />
              <span>
                Jl. Parkit, Blok I, No. 48, RT 004, RW 001,
                <br />
                Cempaka Permai, Gading Cempaka,
                <br />
                Bengkulu, Bengkulu 38221
              </span>
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="flex items-center gap-2">
              <Phone size={13} className="shrink-0" />
              <a href="tel:+6281529990219" className="hover:text-foreground">
                +62 815-2999-0219
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Mail size={13} className="shrink-0" />
              <a href="mailto:support@forjio.com" className="hover:text-foreground">
                support@forjio.com
              </a>
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p>© {new Date().getFullYear()} PT Forjio Teknologi Indonesia.</p>
            <p className="mt-1 font-mono">Part of the Forjio commerce family.</p>
          </div>
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
