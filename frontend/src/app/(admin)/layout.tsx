import type { ReactNode } from 'react';

// (admin) is a route group — only /admin/dashboard and /admin/partners
// enforce auth, via the (admin)/admin/(portal)/layout.tsx gate.
// /admin/login + /admin/forgot-password + /admin/reset-password render
// through this passthrough.
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
