'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
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
  ChevronUp,
  LogOut,
  BookOpen,
  X,
  FileText,
  Shield,
  Home,
  Send,
  Wallet,
  Webhook,
  ScrollText,
} from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}
interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
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

// Mapped to the same CSS var names the plugipay sidebar uses so the
// inline-style block stays byte-identical to the source. Token resolves
// to fulkruma's Twilio-red primary via globals.css.
const THEME_VARS: React.CSSProperties = {
  ['--canvas' as any]: 'hsl(var(--background))',
  ['--paper' as any]: 'hsl(var(--card))',
  ['--ink' as any]: 'hsl(var(--foreground))',
  ['--muted' as any]: 'hsl(var(--muted-foreground))',
  ['--muted-soft' as any]: 'hsl(var(--muted-foreground) / 0.6)',
  ['--border' as any]: 'hsl(var(--border))',
  ['--border-strong' as any]: 'hsl(var(--border))',
  ['--subtle' as any]: 'hsl(var(--primary) / 0.12)',
  ['--indigo' as any]: 'hsl(var(--primary))',
  ['--indigo-soft' as any]: 'hsl(var(--primary) / 0.15)',
  ['--accent' as any]: 'hsl(var(--destructive))',
  ['--font-mono' as any]: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

interface SidebarWorkspace {
  id: string;
  name: string;
  slug?: string;
  plan?: string;
  role?: 'owner' | 'admin' | 'member';
  isForjioInternal?: boolean;
}

function activeHrefFor(pathname: string, sections: NavSection[]): string | null {
  const candidates = sections.flatMap((s) => s.items.map((i) => i.href));
  let best: string | null = null;
  for (const href of candidates) {
    const matches = href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href || pathname.startsWith(href + '/');
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

function titleCase(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function ForjioBadge() {
  return (
    <span
      title="Forjio-operated workspace"
      style={{
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--indigo)',
        background: 'var(--indigo-soft)',
        border: '1px solid var(--indigo-soft)',
        padding: '1px 6px',
        borderRadius: 4,
        flex: '0 0 auto',
      }}
    >
      forjio
    </span>
  );
}

function WorkspaceChiclet({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 28,
        height: 28,
        flex: '0 0 28px',
        borderRadius: 8,
        background: 'var(--indigo-soft)',
        color: 'var(--indigo)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        textTransform: 'uppercase',
        border: '1px solid var(--indigo-soft)',
      }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

function NavList({ pathname, sections, onNavigate }: { pathname: string; sections: NavSection[]; onNavigate?: () => void }) {
  const activeHref = activeHrefFor(pathname, sections);
  return (
    <nav aria-label="Dashboard" style={{ display: 'grid', gap: 16 }}>
      {sections.map((section) => (
        <div key={section.label}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted-soft)',
              padding: '0 10px 6px',
              fontWeight: 600,
            }}
          >
            {section.label}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 1 }}>
            {section.items.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon as LucideIcon;
              const linkStyle: React.CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--ink)' : 'var(--muted)',
                padding: '7px 10px',
                borderRadius: 8,
                background: active ? 'var(--subtle)' : 'transparent',
                cursor: 'pointer',
                textDecoration: 'none',
              };
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={onNavigate} style={linkStyle}>
                    <Icon size={15} strokeWidth={2} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--ink)',
  borderRadius: 6,
  textDecoration: 'none',
};

function ProfileDropdown({ user, onLogout, onNavigate }: { user: SessionUser; onLogout: () => void; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const name = user?.name || 'You';
  const email = user?.email || '';
  const initial = (user?.name || user?.email || '?').slice(0, 1).toUpperCase();

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        borderTop: '1px solid var(--border)',
        padding: '12px 10px',
      }}
    >
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 10,
            right: 10,
            marginBottom: 6,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--paper)',
            boxShadow: '0 10px 30px -12px rgba(0, 0, 0, 0.5)',
            padding: 4,
            zIndex: 20,
          }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-all' }}>{email}</div>
          </div>
          <Link href="/docs" onClick={() => { setOpen(false); onNavigate?.(); }} style={dropdownItemStyle}>
            <BookOpen size={14} /> Documentation
          </Link>
          <Link href="/terms" onClick={() => { setOpen(false); onNavigate?.(); }} style={dropdownItemStyle}>
            <FileText size={14} /> Terms of Service
          </Link>
          <Link href="/privacy" onClick={() => { setOpen(false); onNavigate?.(); }} style={dropdownItemStyle}>
            <Shield size={14} /> Privacy Policy
          </Link>
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            style={{ ...dropdownItemStyle, color: 'var(--accent)', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '8px 8px',
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          style={{
            width: 32,
            height: 32,
            flex: '0 0 32px',
            borderRadius: '50%',
            background: 'var(--indigo)',
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {initial}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {email}
          </span>
        </span>
        <ChevronUp size={14} strokeWidth={2} style={{ color: 'var(--muted)', transform: open ? '' : 'rotate(180deg)', transition: 'transform 120ms ease' }} />
      </button>
    </div>
  );
}

type SessionUser = { name: string; email: string } | null;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
}

export function Sidebar({ open, onClose, user }: SidebarProps) {
  const pathname = usePathname() ?? '';

  const [workspaces, setWorkspaces] = useState<SidebarWorkspace[]>([]);
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
        const list: SidebarWorkspace[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
        setWorkspaces(list);
        const cookieActive = document.cookie
          .split('; ')
          .find((r) => r.startsWith('fulkruma_active_workspace='))
          ?.split('=').slice(1).join('=');
        const match = cookieActive ? list.find((w) => w.id === decodeURIComponent(cookieActive)) : null;
        const active = match ?? list.find((w) => w.role === 'owner') ?? list[0];
        if (active) setActiveWorkspaceId(active.id);
      })
      .catch(() => {/* non-fatal — selector just shows the user card */});
    return () => { cancelled = true; };
  }, []);

  function switchWorkspace(id: string) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `fulkruma_active_workspace=${encodeURIComponent(id)}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax${secure}`;
    window.location.reload();
  }

  async function handleLogout() {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      window.location.href = '/';
    }
  }

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const others = workspaces.filter((w) => w.id !== activeWorkspaceId);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        style={{
          ...THEME_VARS,
          borderRight: '1px solid var(--border)',
          background: 'var(--paper)',
          width: 248,
          display: 'flex',
          flexDirection: 'column',
        }}
        className={`fixed inset-y-0 left-0 z-50 h-screen transition-transform lg:sticky lg:top-0 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" onClick={onClose} aria-label="Fulkruma dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', textDecoration: 'none' }}>
            <LogoMark size={22} />
            Fulkruma
          </Link>
          <button onClick={onClose} className="lg:hidden" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 4 }} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <WorkspaceSwitcher
          active={active}
          others={others}
          hasAny={workspaces.length > 0}
          onSwitch={switchWorkspace}
          onNavigate={onClose}
        />

        <div style={{ flex: 1, padding: '16px 10px', overflowY: 'auto' }}>
          <NavList pathname={pathname} sections={navSections} onNavigate={onClose} />
        </div>

        <ProfileDropdown user={user} onLogout={handleLogout} onNavigate={onClose} />
      </aside>
    </>
  );
}

function WorkspaceSwitcher({
  active,
  others,
  hasAny,
  onSwitch,
  onNavigate,
}: {
  active: SidebarWorkspace | null;
  others: SidebarWorkspace[];
  hasAny: boolean;
  onSwitch: (id: string) => void;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!hasAny) return null;

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        padding: '12px 10px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 10,
            right: 10,
            marginTop: 6,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--paper)',
            boxShadow: '0 10px 30px -12px rgba(0, 0, 0, 0.5)',
            padding: 4,
            zIndex: 20,
          }}
        >
          {others.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => { setOpen(false); onSwitch(w.id); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 10px',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: 6,
                color: 'inherit',
              }}
            >
              <WorkspaceChiclet name={w.name} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
                  {w.isForjioInternal && <ForjioBadge />}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{titleCase(w.role)}</span>
              </span>
            </button>
          ))}
          {others.length > 0 && <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />}
          <Link
            href="/dashboard/settings"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', fontSize: 13, color: 'var(--muted)', textDecoration: 'none', borderRadius: 6,
            }}
          >
            <Building2 size={14} /> Manage workspaces
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!active}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '6px 6px',
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          cursor: active ? 'pointer' : 'default',
          textAlign: 'left',
          color: 'inherit',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <WorkspaceChiclet name={active?.name ?? '?'} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {active?.name ?? 'Loading…'}
            </span>
            {active?.isForjioInternal && <ForjioBadge />}
          </span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>
            {active ? titleCase(active.role) : ''}
          </span>
        </span>
        <ChevronUp size={14} strokeWidth={2} style={{ color: 'var(--muted)', transform: open ? 'rotate(180deg)' : '', transition: 'transform 120ms ease' }} />
      </button>
    </div>
  );
}
