import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-16 md:py-24">
      {children}
    </div>
  );
}
