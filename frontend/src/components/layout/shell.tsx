'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Warehouse,
  Boxes,
  Truck,
  PackageCheck,
  KeyRound,
  Settings,
  Building2,
  Send,
  Wallet,
  Webhook,
  ScrollText,
  Package,
  LifeBuoy,
  BookOpen,
  FileText,
  Shield,
} from 'lucide-react';
import {
  Sidebar,
  MobileHeader,
  readActiveWorkspaceId,
  type NavSection,
  type PortalWorkspace,
  type PortalLink,
  type SessionUser,
} from '@forjio/portal-ui';
import { LogoMark } from '@/components/brand/logo';
import {
  useAssistantActivity,
  useCatentioCredits,
  useCatentioStatus,
} from '@/hooks/use-catentio';
import { CatentioDockedChat } from '@/components/catentio/docked-chat';

/*
 * Dashboard shell — the authenticated portal chrome. `@forjio/portal-ui`
 * Sidebar renders the workspace switcher, nav, and profile dropdown; this
 * host file supplies the workspace list, active id, nav sections, user,
 * the mobile-drawer open state, and the logout handler.
 *
 * Fulkruma-specific behavior preserved from the pre-migration local
 * sidebar:
 *  - workspaces come from the Huudis auto-refresh proxy at
 *    `/api/v1/huudis/account/workspaces` (not a fulkruma-native route)
 *  - the active workspace is auto-selected (owner first); persistence is
 *    cookie-based (`fulkruma_active_workspace`), and switching reloads
 *    the page — portal-ui's default `onWorkspaceSwitch` behavior
 *  - logout redirects to `/` (fulkruma home), not `/login`
 */

const BRAND = 'Fulkruma';
const BRAND_SLUG = 'fulkruma';
// Hosted Suppuo support portal for the Fulkruma workspace. Opened in a
// new tab from the dashboard Account nav so logged-in merchants can
// reach support without leaving the portal.
const SUPPORT_PORTAL_URL = 'https://suppuo.com/portal/fulkruma';
// Fulkruma Twilio-red accent — theme-following. `--primary` is an HSL
// triplet in globals.css; portal-ui's `brandColorSoft` prop lets the
// soft accent track it too, so neither value has to be a static hex.
const BRAND_COLOR = 'hsl(var(--primary))';
const BRAND_COLOR_SOFT = 'hsl(var(--primary) / 0.15)';

const SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Catalogue',
    items: [{ href: '/dashboard/products', label: 'Products', icon: Package }],
  },
  {
    label: 'Digital',
    items: [
      { href: '/dashboard/deliveries', label: 'Digital Deliveries', icon: PackageCheck },
      { href: '/dashboard/licenses', label: 'Licenses', icon: KeyRound },
    ],
  },
  {
    label: 'Physical',
    items: [
      { href: '/dashboard/shipments', label: 'Shipments', icon: Truck },
      { href: '/dashboard/shipping-credits', label: 'Shipping Credits', icon: Wallet },
      { href: '/dashboard/stock', label: 'Inventory', icon: Boxes },
      { href: '/dashboard/warehouses', label: 'Warehouse', icon: Warehouse },
      { href: '/dashboard/shipping', label: 'Shipping', icon: Send },
    ],
  },
  {
    label: 'Developer',
    items: [
      { href: '/dashboard/api-keys', label: 'API Keys', icon: KeyRound },
      { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/dashboard/audit-log', label: 'Audit Log', icon: ScrollText },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/dashboard/workspaces', label: 'Workspaces', icon: Building2 },
      { href: '/dashboard/billing', label: 'Billing', icon: Wallet },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
];

// Profile-dropdown footer links (portal-ui Sidebar `dropdownLinks`). Support
// lives here — in the profile dropdown — alongside the docs/legal links,
// rather than as a main-nav item.
const DROPDOWN_LINKS = [
  { href: '/docs', label: 'Documentation', icon: BookOpen },
  { href: SUPPORT_PORTAL_URL, label: 'Support', icon: LifeBuoy },
  { href: '/terms', label: 'Terms of Service', icon: FileText },
  { href: '/privacy', label: 'Privacy Policy', icon: Shield },
];

async function logout() {
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    window.location.href = '/';
  }
}

/**
 * Cross-portal switcher (portal-ui >=0.5.0) — Fulkruma has the merchant
 * portal and the in-product admin console. The admin entry is included
 * so staff can hop in/out; the backend `gate` still enforces who may
 * actually open the admin session, so a non-admin who clicks it just
 * lands on /admin/login.
 */
const PORTALS: PortalLink[] = [
  { label: 'Merchant', href: '/dashboard', current: true },
  { label: 'Admin', href: '/admin/dashboard' },
];

export function DashboardShell({
  user,
  children,
}: {
  user: { name: string; email: string } | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Embedded catentio assistant — flag-gated per user; flag off =
  // sidebar + column unchanged. The chip math is linksnap's: fill =
  // consumed share of the LARGER of the monthly grant and everything the
  // wallet actually had this period.
  const { enabled: assistantEnabled } = useCatentioStatus();
  const { credits, refresh: refreshCredits } = useCatentioCredits(assistantEnabled);
  useAssistantActivity(() => {
    refreshCredits();
    const timer = setTimeout(refreshCredits, 2500);
    return () => clearTimeout(timer);
  });
  const chipCredits = useMemo(() => {
    if (!credits) return null;
    const balance = credits.balance.credits;
    const period = new Date().toISOString().slice(0, 7);
    const used =
      credits.balance.used_this_period_credits ??
      credits.ledger
        .filter(
          (r) =>
            r.kind === 'embedded_agent_usage' &&
            r.credits < 0 &&
            (r.at ?? '').slice(0, 7) === period,
        )
        .reduce((a, r) => a + -r.credits, 0);
    const grant = credits.balance.monthly_grant_credits ?? 0;
    const limit = Math.max(grant, Math.max(balance, 0) + used);
    const now = new Date();
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const date = reset.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const time = reset.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return {
      credits: balance,
      grantCredits: limit,
      usedFraction: limit > 0 ? Math.min(1, used / limit) : 0,
      caption: `Resets ${date}, ${time}`,
      href: '/dashboard/billing#credits',
    };
  }, [credits]);
  const [workspaces, setWorkspaces] = useState<PortalWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Source workspaces from the Huudis proxy — the auto-refresh proxy
    // at /api/v1/huudis/[...path] forwards to huudis /account/workspaces
    // with the access token attached.
    fetch('/api/v1/huudis/account/workspaces', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        const list: PortalWorkspace[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
          ? body.data
          : [];
        setWorkspaces(list);
        const cookieActive = readActiveWorkspaceId('cookie', BRAND_SLUG);
        const match = cookieActive ? list.find((w) => w.id === cookieActive) : null;
        const active = match ?? list.find((w) => w.role === 'owner') ?? list[0];
        if (active) setActiveWorkspaceId(active.id);
      })
      .catch(() => {
        /* non-fatal — selector just shows the user card */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    // h-dvh + overflow-hidden, NOT min-h-screen: the docked assistant
    // anchors to the content column, so the column has to be exactly
    // viewport height or the dock lands below the fold on any page taller
    // than the screen. Scrolling moves into <main>.
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        brandSlug={BRAND_SLUG}
        brandName={BRAND}
        brandColor={BRAND_COLOR}
        brandColorSoft={BRAND_COLOR_SOFT}
        brandIcon={<LogoMark size={22} />}
        workspacePersist="cookie"
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        sections={SECTIONS}
        credits={chipCredits}
        portals={PORTALS}
        dropdownLinks={DROPDOWN_LINKS}
        user={user as SessionUser}
        onLogout={logout}
        open={open}
        onClose={() => setOpen(false)}
      />
      <div className="relative flex flex-1 flex-col min-w-0 overflow-hidden">
        <MobileHeader
          brandSlug={BRAND_SLUG}
          brandName={BRAND}
          brandColor={BRAND_COLOR}
          brandColorSoft={BRAND_COLOR_SOFT}
          brandIcon={<LogoMark size={22} />}
          workspacePersist="cookie"
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onMenuOpen={() => setOpen(true)}
        />
        {/* pb-52 reserves room for the docked composer so the last row of
            content is never hidden under it. The md:pb-52 is NOT redundant:
            md:p-6 sets padding-bottom too and emits after a bare pb-52. */}
        <main
          className={`min-w-0 flex-1 overflow-y-auto p-4 md:p-6 max-w-[1400px] w-full mx-auto ${
            assistantEnabled ? 'pb-52 md:pb-52' : ''
          }`}
        >
          {children}
        </main>
        {/* Embedded catentio agent — the docked chat. Lives inside the
            content column so it centers on the CONTENT (sidebar
            excluded). Renders nothing unless the pilot flag says so. */}
        <CatentioDockedChat />
      </div>
    </div>
  );
}
