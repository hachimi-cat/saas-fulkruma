'use client';

import { useState } from 'react';
import { Menu, LayoutDashboard, Building2, FileText, Shield } from 'lucide-react';
import {
  Sidebar,
  type NavSection,
  type SessionUser,
  type LucideIcon,
  type PortalLink,
} from '@forjio/portal-ui';
import { LogoMark } from '@/components/brand/logo';

/*
 * Admin dashboard shell — the authenticated chrome for Fulkruma's
 * in-product staff console (partner-billing review).
 *
 * `@forjio/portal-ui` Sidebar (>=0.5.0) runs here in **no-workspace
 * mode**: the `workspaces` / `activeWorkspaceId` / `workspacePersist`
 * props are omitted, so the workspace switcher is not rendered — just
 * brand header → nav → profile dropdown. An admin account has no
 * fulkruma workspace concept; the gate is Fulkruma-Huudis-workspace
 * membership at sign-in time.
 *
 * This is a thin host: it owns the admin nav map, the logout redirect,
 * the dropdown links, and the mobile-drawer open state. The merchant
 * surface keeps its own `shell.tsx` and is unaffected.
 */

const BRAND = 'Fulkruma';
const BRAND_SLUG = 'fulkruma';
// Fulkruma Twilio-red accent — theme-following. `--primary` is an HSL
// triplet in globals.css; portal-ui's `brandColorSoft` prop lets the
// soft accent track it too, so neither value has to be a static hex.
const BRAND_COLOR = 'hsl(var(--primary))';
const BRAND_COLOR_SOFT = 'hsl(var(--primary) / 0.15)';

const SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Partner billing',
    items: [{ href: '/admin/partners', label: 'Partner usage', icon: Building2 }],
  },
];

/** Profile-dropdown footer links — the admin portal is internal staff
 *  tooling, it ships no docs, just the legal pages on the marketing
 *  site. */
const DROPDOWN_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/legal/terms', label: 'Terms of Service', icon: FileText },
  { href: '/legal/privacy', label: 'Privacy Policy', icon: Shield },
];

/**
 * Cross-portal switcher (portal-ui >=0.5.0). Fulkruma has the merchant
 * portal and this admin console — listing the admin entry is safe: the
 * backend `gate` enforces who may actually open the admin session, so
 * a non-admin who clicks it just lands on /admin/login.
 */
const PORTALS: PortalLink[] = [
  { label: 'Merchant', href: '/dashboard' },
  { label: 'Admin', href: '/admin/dashboard', current: true },
];

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; email: string } | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  async function logout() {
    try {
      await fetch('/api/v1/auth/logout?role=admin', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      window.location.href = '/admin/login';
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        brandSlug={BRAND_SLUG}
        brandName={BRAND}
        brandColor={BRAND_COLOR}
        brandColorSoft={BRAND_COLOR_SOFT}
        brandIcon={<LogoMark size={22} />}
        brandTag="Admin"
        brandHref="/admin/dashboard"
        sections={SECTIONS}
        portals={PORTALS}
        user={user as SessionUser}
        onLogout={logout}
        dropdownLinks={DROPDOWN_LINKS}
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
        <main className="min-w-0 flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
