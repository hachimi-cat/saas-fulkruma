'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings as SettingsIcon, ExternalLink, Copy, Check } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Loading } from '@/components/dashboard/ui';

interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    huudisUserId: string;
  };
}

export default function SettingsPage() {
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/session', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) return;
        const body = (await r.json()) as MeResponse;
        if (body.user) setMe(body.user);
      });
  }, []);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        description="Profile + workspace info. Identity + workspace management lives in Huudis."
      />

      {!me && <Loading />}

      {me && (
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Profile</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Your name + email come from Huudis. Update them there to propagate across the Forjio family.
            </p>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Stat label="Name" value={me.name} />
              <Stat label="Email" value={me.email} />
              <Stat
                label="Huudis user ID"
                value={me.huudisUserId}
                mono
                copyable
                copied={copied === 'uid'}
                onCopy={() => copy(me.huudisUserId, 'uid')}
              />
              <Stat
                label="Account ID (this workspace)"
                value={me.id}
                mono
                copyable
                copied={copied === 'aid'}
                onCopy={() => copy(me.id, 'aid')}
              />
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href="https://huudis.com/dashboard/profile" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium hover:bg-secondary">
                Manage profile in Huudis <ExternalLink size={14} />
              </a>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Workspaces</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Switch between workspaces from the sidebar workspace switcher. Create new ones in Huudis.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/dashboard/workspaces" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium hover:bg-secondary">
                View workspaces
              </Link>
              <a href="https://huudis.com/dashboard/workspaces" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium hover:bg-secondary">
                Create new in Huudis <ExternalLink size={14} />
              </a>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Sessions + security</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Active sessions and MFA settings are centralized in Huudis.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="https://huudis.com/dashboard/security" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium hover:bg-secondary">
                Open Huudis security <ExternalLink size={14} />
              </a>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Danger zone</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Delete a workspace or downgrade your plan. Both happen in Huudis / Plugipay respectively.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono, copyable, copied, onCopy }: { label: string; value: string; mono?: boolean; copyable?: boolean; copied?: boolean; onCopy?: () => void }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-1 flex items-center gap-2 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>
        <span className="break-all">{value}</span>
        {copyable && (
          <button onClick={onCopy} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] hover:bg-secondary">
            {copied ? <><Check size={10} /> copied</> : <><Copy size={10} /> copy</>}
          </button>
        )}
      </dd>
    </div>
  );
}
