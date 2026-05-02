import type { ReactNode } from 'react';
import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />
      <div className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-16 md:py-24">
        {children}
      </div>
      <MarketingFooter />
    </div>
  );
}
