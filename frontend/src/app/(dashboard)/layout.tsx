import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Shell } from '@/components/layout/shell';
import { readSession } from '@/lib/server/session';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await readSession();
  if (!session) {
    redirect('/login');
  }
  return <Shell>{children}</Shell>;
}
