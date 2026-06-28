import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { gellix } from '@forjio/website-ui/fonts';
import '@forjio/website-ui/styles/marketing.css';
import './globals.css';

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Fulkruma';

// Geist Sans / Mono — the Forjio family body + mono faces (matches malapos).
// globals.css binds --font-sans / --font-mono to their --font-geist-* vars.

// Gellix (Forjio family display face) now ships from @forjio/website-ui
// — the local public/fonts/Gellix-*.woff2 files have been removed.

export const metadata: Metadata = {
  title: { default: `${brand} — stock + shipping for storefronts`, template: `%s | ${brand}` },
  description: `${brand} handles inventory, warehouses, and shipping. Part of the Forjio commerce family.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No bg on <html> — body bg propagates to canvas via CSS, which is
  // required for the marketing hero's `-z-10` pattern divs to paint.
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${gellix.variable} bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
