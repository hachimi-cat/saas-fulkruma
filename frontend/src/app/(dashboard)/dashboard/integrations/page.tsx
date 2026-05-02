'use client';

import { useEffect, useState } from 'react';
import { Plug, Check, X as XIcon, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { api, type BiteshipConfig } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { ErrorBox, Loading } from '@/components/dashboard/ui';

interface Integration {
  slug: string;
  name: string;
  description: string;
  configHref: string;
  status: 'connected' | 'partial' | 'disconnected';
  detail: string;
  external?: boolean;
}

export default function IntegrationsPage() {
  const [biteship, setBiteship] = useState<BiteshipConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ config: BiteshipConfig | null }>('/shipping/config')
      .then((d) => { setBiteship(d.config); setLoaded(true); })
      .catch((e) => setError((e as Error).message));
  }, []);

  const integrations: Integration[] = [
    {
      slug: 'huudis',
      name: 'Huudis',
      description: 'Authentication + identity. Required.',
      configHref: 'https://huudis.com/dashboard',
      status: 'connected',
      detail: 'Sign-in active. Workspace synced.',
      external: true,
    },
    {
      slug: 'plugipay',
      name: 'Plugipay',
      description: 'Payments. Drives the inbound webhook that commits stock reservations on payment success.',
      configHref: 'https://plugipay.com/dashboard',
      status: process.env.NEXT_PUBLIC_PLUGIPAY_CONFIGURED === 'true' ? 'connected' : 'partial',
      detail: process.env.NEXT_PUBLIC_PLUGIPAY_CONFIGURED === 'true'
        ? 'Webhook endpoint registered, events flowing.'
        : 'Webhook endpoint registered. Plugipay platform-admin key not yet minted.',
      external: true,
    },
    {
      slug: 'biteship',
      name: 'Biteship',
      description: 'Indonesian courier coverage (JNE, SiCepat, J&T, …). Drives shipment creation + tracking.',
      configHref: '/dashboard/shipping',
      status: biteship?.active && biteship.apiKeyConfigured ? 'connected' : biteship?.apiKeyConfigured ? 'partial' : 'disconnected',
      detail: biteship?.active && biteship.apiKeyConfigured
        ? `${biteship.enabledCouriers.length} courier${biteship.enabledCouriers.length === 1 ? '' : 's'} enabled.`
        : biteship?.apiKeyConfigured ? 'API key configured but inactive.' : 'API key not set.',
    },
    {
      slug: 'storlaunch',
      name: 'Storlaunch',
      description: 'Storefront. Consumes Fulkruma as a fulfilment module.',
      configHref: 'https://storlaunch.com/dashboard/settings/modules',
      status: 'partial',
      detail: 'Module wiring lands in Phase F.',
      external: true,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={Plug}
        title="Integrations"
        description="External services Fulkruma talks to. Each card surfaces connection status + a configure link."
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!loaded && !error && <Loading />}

      {loaded && (
        <ul className="space-y-3">
          {integrations.map((i) => (
            <li key={i.slug} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5">
              <StatusDot status={i.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{i.name}</p>
                  <StatusBadge status={i.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
              </div>
              {i.external ? (
                <a href={i.configHref} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                  Configure <ExternalLink size={12} />
                </a>
              ) : (
                <Link href={i.configHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                  Configure
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: Integration['status'] }) {
  const cls = status === 'connected' ? 'bg-emerald-500' : status === 'partial' ? 'bg-amber-500' : 'bg-muted-foreground/40';
  return <span className={`h-2.5 w-2.5 rounded-full ${cls}`} aria-hidden />;
}

function StatusBadge({ status }: { status: Integration['status'] }) {
  if (status === 'connected') {
    return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700"><Check size={10} /> connected</span>;
  }
  if (status === 'partial') {
    return <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700">partial</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"><XIcon size={10} /> not connected</span>;
}
