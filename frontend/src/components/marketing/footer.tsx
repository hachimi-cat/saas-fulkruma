import Link from 'next/link';
import { MapPin, Phone, Mail } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';

const footerLinks = {
  Product: [
    { href: '/features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/docs', label: 'Documentation' },
    { href: '/changelog', label: 'Changelog' },
  ],
  Company: [
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ],
  Legal: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
    { href: '/refund', label: 'Refund Policy' },
  ],
};

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <LogoMark size={22} />
              <span className="font-bold tracking-tight">Fulkruma</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Stock + shipping for Indonesian storefronts — part of the Forjio family.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold">{category}</h3>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 border-t border-border pt-8 text-xs text-muted-foreground sm:grid-cols-3">
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
            <p>&copy; {new Date().getFullYear()} PT Forjio Teknologi Indonesia.</p>
            <p className="mt-1">Stock · shipping · part of the Forjio family.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
