import type { ReactNode } from 'react';
import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-site flex min-h-screen flex-col bg-background text-foreground">
      <MarketingNav />
      <div className="flex-1">{children}</div>
      <MarketingFooter />
    </div>
  );
}
