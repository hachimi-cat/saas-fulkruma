import type { Metadata } from 'next';
import './globals.css';

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Fulkruma';

export const metadata: Metadata = {
  title: { default: brand, template: `%s | ${brand}` },
  description: `${brand} — part of the Forjio commerce suite.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
