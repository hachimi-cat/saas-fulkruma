'use client';

import { useEffect, useState } from 'react';
import { Plug, Check, X as XIcon, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { ErrorBox, Loading } from '@/components/dashboard/ui';

interface Status {
  huudis: { connected: boolean };
  biteship: {
    apiKeyConfigured: boolean;
    active: boolean;
    enabledCouriers: string[];
  } | null;
  plugipay: {
    webhookSecretSet: boolean;
    partnerKey: { configured: boolean };
    lastEventAt: string | null;
  };
  storlaunch: {
    webhookSecretSet: boolean;
    partnerKey: { configured: boolean };
    mirroredProductCount: number;
    lastSyncAt: string | null;
  };
}

interface Integration {
  slug: string;
  name: string;
  description: string;
  configHref: string;
  status: 'connected' | 'partial' | 'disconnected';
  detail: string;
  external?: boolean;
}

function deriveIntegrations(s: Status): Integration[] {
  // ─ Plugipay ────────────────────────────────────────────────────
  // Connected: webhook secret set + platform-admin key in env (so we
  // can call plugipay.admin.* on behalf of merchants).
  // Partial: webhook receiver wired but partner key not minted yet.
  let plugipayStatus: Integration['status'];
  let plugipayDetail: string;
  if (s.plugipay.webhookSecretSet && s.plugipay.partnerKey.configured) {
    plugipayStatus = 'connected';
    plugipayDetail = s.plugipay.lastEventAt
      ? `Last event ${new Date(s.plugipay.lastEventAt).toLocaleString()}.`
      : 'Webhook + partner key wired. No events yet.';
  } else if (s.plugipay.webhookSecretSet) {
    plugipayStatus = 'partial';
    plugipayDetail = 'Webhook receiver wired. Mint a Plugipay platform-admin key to enable Pattern-2 partner billing.';
  } else {
    plugipayStatus = 'disconnected';
    plugipayDetail = 'PLUGIPAY_WEBHOOK_SECRET not set. Webhook receiver returns 401.';
  }

  // ─ Biteship ────────────────────────────────────────────────────
  let biteshipStatus: Integration['status'];
  let biteshipDetail: string;
  if (s.biteship?.active && s.biteship.apiKeyConfigured) {
    biteshipStatus = 'connected';
    const n = s.biteship.enabledCouriers.length;
    biteshipDetail = `${n} courier${n === 1 ? '' : 's'} enabled.`;
  } else if (s.biteship?.apiKeyConfigured) {
    biteshipStatus = 'partial';
    biteshipDetail = 'API key configured but inactive. Toggle on in Shipping.';
  } else {
    biteshipStatus = 'disconnected';
    biteshipDetail = 'API key not set.';
  }

  // ─ Storlaunch ──────────────────────────────────────────────────
  // Connected: shared signing secret configured + platform-admin key
  // for storlaunch exists in ApiKey table.
  // Partial: one of those is missing.
  let storlaunchStatus: Integration['status'];
  let storlaunchDetail: string;
  if (s.storlaunch.webhookSecretSet && s.storlaunch.partnerKey.configured) {
    storlaunchStatus = 'connected';
    if (s.storlaunch.mirroredProductCount > 0) {
      storlaunchDetail = `${s.storlaunch.mirroredProductCount} product${s.storlaunch.mirroredProductCount === 1 ? '' : 's'} mirrored from Storlaunch${s.storlaunch.lastSyncAt ? ` · last sync ${new Date(s.storlaunch.lastSyncAt).toLocaleString()}` : ''}.`;
    } else {
      storlaunchDetail = 'Wired and ready. No products mirrored yet — they sync on next Storlaunch product CRUD.';
    }
  } else if (s.storlaunch.webhookSecretSet || s.storlaunch.partnerKey.configured) {
    storlaunchStatus = 'partial';
    if (!s.storlaunch.partnerKey.configured) {
      storlaunchDetail = 'Webhook signing secret set. Mint a platform-admin key for storlaunch (`backend/scripts/mint-platform-key.ts --partner storlaunch`).';
    } else {
      storlaunchDetail = 'Partner-admin key minted. Set STORLAUNCH_WEBHOOK_SECRET on this backend to verify inbound deliveries.';
    }
  } else {
    storlaunchStatus = 'disconnected';
    storlaunchDetail = 'Neither shared signing secret nor partner-admin key configured.';
  }

  return [
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
      status: plugipayStatus,
      detail: plugipayDetail,
      external: true,
    },
    {
      slug: 'biteship',
      name: 'Biteship',
      description: 'Indonesian courier coverage (JNE, SiCepat, J&T, …). Drives shipment creation + tracking.',
      configHref: '/dashboard/shipping',
      status: biteshipStatus,
      detail: biteshipDetail,
    },
    {
      slug: 'storlaunch',
      name: 'Storlaunch',
      description: 'Storefront. Consumes Fulkruma as a fulfilment module — products sync inbound via webhook.',
      configHref: 'https://storlaunch.com/dashboard/settings/modules',
      status: storlaunchStatus,
      detail: storlaunchDetail,
      external: true,
    },
  ];
}

export default function IntegrationsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Status>('/integrations/status')
      .then(setStatus)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="">
      <PageHeader
        title="Integrations"
        description="External services Fulkruma talks to. Each card surfaces real connection status + a configure link."
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!status && !error && <Loading />}

      {status && (
        <ul className="space-y-3">
          {deriveIntegrations(status).map((i) => (
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
