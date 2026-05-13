import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';

export function MarketingNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <LogoMark size={26} />
          <span className="text-base font-semibold tracking-tight">Fulkruma</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm md:flex">
          <a href="/#features" className="text-muted-foreground hover:text-foreground transition">
            Features
          </a>
          <a href="/#pricing" className="text-muted-foreground hover:text-foreground transition">
            Pricing
          </a>
          <a href="/#integrations" className="text-muted-foreground hover:text-foreground transition">
            Integrations
          </a>
          <a href="/#faq" className="text-muted-foreground hover:text-foreground transition">
            FAQ
          </a>
          <a href="/docs" className="text-muted-foreground hover:text-foreground transition">
            Docs
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
  );
}
