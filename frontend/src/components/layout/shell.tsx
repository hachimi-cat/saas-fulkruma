'use client';

import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Warehouse,
  Boxes,
  Truck,
  PackageCheck,
  KeyRound,
  Plug,
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
  Menu,
} from 'lucide-react';
import {
  Sidebar,
  readActiveWorkspaceId,
  type NavSection,
  type PortalWorkspace,
  type PortalLink,
  type SessionUser,
} from '@forjio/portal-ui';
import { LogoMark } from '@/components/brand/logo';

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
      { href: '/dashboard/integrations', label: 'Integrations', icon: Plug },
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
    <div className="flex min-h-screen bg-background">
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
        portals={PORTALS}
        dropdownLinks={DROPDOWN_LINKS}
        user={user as SessionUser}
        onLogout={logout}
        open={open}
        onClose={() => setOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex h-14 items-center border-b border-border bg-card px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <main className="min-w-0 flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
