import type { Metadata } from 'next';
import './globals.css';

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Fulkruma';

export const metadata: Metadata = {
  title: { default: `${brand} — stock + shipping for storefronts`, template: `%s | ${brand}` },
  description: `${brand} handles inventory, warehouses, and shipping. Part of the Forjio commerce family.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-background">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
