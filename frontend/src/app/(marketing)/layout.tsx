import type { ReactNode } from 'react';
import Script from 'next/script';
import { MarketingShell, MarketingNav, MarketingFooter } from '@forjio/website-ui';
import { LogoMark } from '@/components/brand/logo';

// Suppuo hosted support page (live chat + help form) for Fulkruma.
const SUPPUO_SUPPORT_URL = 'https://suppuo.com/support/acc_01KPHFWPES4T3T0XSM9MT6ZJYV';

// Override the default footer columns to add a dedicated "Help & live chat"
// entry pointing at the hosted Suppuo support page (kept alongside Contact).
const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/docs', label: 'Documentation' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: SUPPUO_SUPPORT_URL, label: 'Help center' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/refund', label: 'Refund Policy' },
    ],
  },
];

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingShell>
      <MarketingNav
        brandIcon={<LogoMark size={24} />}
        brandName="Fulkruma"
      />
      <div className="flex-1">{children}</div>
      <MarketingFooter
        brandIcon={<LogoMark size={22} />}
        brandName="Fulkruma"
        brandTagline="Stock + shipping for Indonesian storefronts — part of the Forjio family."
        columns={FOOTER_COLUMNS}
      />
      <Script
        src="https://suppuo.com/widget.js"
        data-suppuo-account="acc_01KPHFWPES4T3T0XSM9MT6ZJYV"
        strategy="afterInteractive"
      />
    </MarketingShell>
  );
}
