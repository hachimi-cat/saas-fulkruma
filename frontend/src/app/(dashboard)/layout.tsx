import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/shell';
import { readSession } from '@/lib/server/session';
import { fetchAccount } from '@/lib/server/huudis';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await readSession();
  if (!session) {
    redirect('/login');
  }

  let user: { name: string; email: string } | null = null;
  try {
    const account = await fetchAccount(session.huudisAccessToken);
    user = {
      name: account.name ?? account.email,
      email: account.email,
    };
  } catch {
    // Token may have expired between layout render and account fetch.
    // The /api/v1/session endpoint refreshes proactively; if even that
    // fails, send the user back to login.
    redirect('/login');
  }

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
