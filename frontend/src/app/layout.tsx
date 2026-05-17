import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
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

// Gellix is the Forjio family's display face — used for marketing-site
// headings to keep brand voice consistent with forjio.com. Body copy
// stays on Inter; mono stays on JetBrains Mono.
const gellix = localFont({
  src: [
    { path: '../../public/fonts/Gellix-Regular.woff2', weight: '400' },
    { path: '../../public/fonts/Gellix-Medium.woff2', weight: '500' },
    { path: '../../public/fonts/Gellix-SemiBold.woff2', weight: '600' },
    { path: '../../public/fonts/Gellix-Bold.woff2', weight: '700' },
  ],
  display: 'swap',
  variable: '--font-display',
});

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
