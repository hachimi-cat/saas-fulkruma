import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { gellix } from '@forjio/website-ui/fonts';
import '@forjio/website-ui/styles/marketing.css';
import './globals.css';

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Fulkruma';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

// Gellix (Forjio family display face) now ships from @forjio/website-ui
// — the local public/fonts/Gellix-*.woff2 files have been removed.

export const metadata: Metadata = {
  title: { default: `${brand} — stock + shipping for storefronts`, template: `%s | ${brand}` },
  description: `${brand} handles inventory, warehouses, and shipping. Part of the Forjio commerce family.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-background">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${gellix.variable} bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
