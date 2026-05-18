import type { ReactNode } from 'react';
import { MarketingShell, MarketingNav, MarketingFooter } from '@forjio/website-ui';
import { LogoMark } from '@/components/brand/logo';

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
      />
    </MarketingShell>
  );
}
