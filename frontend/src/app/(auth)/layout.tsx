import type { ReactNode } from 'react';
import { MarketingNav, MarketingFooter } from '@forjio/website-ui';
import { LogoMark } from '@/components/brand/logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav
        brandIcon={<LogoMark size={24} />}
        brandName="Fulkruma"
      />
      <div className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-16 md:py-24">
        {children}
      </div>
      <MarketingFooter
        brandIcon={<LogoMark size={22} />}
        brandName="Fulkruma"
        brandTagline="Stock + shipping for Indonesian storefronts — part of the Forjio family."
      />
    </div>
  );
}
