import {
  LayoutDashboard,
  Warehouse,
  Boxes,
  ArrowLeftRight,
  ClipboardList,
  Truck,
  MapPin,
  PackageCheck,
  KeyRound,
  Settings,
  Plug,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const dashboardNav: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/dashboard/warehouses', label: 'Warehouses', icon: Warehouse },
      { href: '/dashboard/stock', label: 'Stock levels', icon: Boxes },
      { href: '/dashboard/movements', label: 'Movements', icon: ArrowLeftRight },
      { href: '/dashboard/reservations', label: 'Reservations', icon: ClipboardList },
    ],
  },
  {
    label: 'Fulfilment',
    items: [
      { href: '/dashboard/shipments', label: 'Shipments', icon: Truck },
      { href: '/dashboard/addresses', label: 'Addresses', icon: MapPin },
      { href: '/dashboard/deliveries', label: 'Deliveries', icon: PackageCheck },
      { href: '/dashboard/licenses', label: 'Licenses', icon: KeyRound },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/dashboard/integrations', label: 'Integrations', icon: Plug },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const marketingNav = [
  { href: '/#features', label: 'Product' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#integrations', label: 'Integrations' },
  { href: '/docs', label: 'Docs' },
];

export const footerSections: { heading: string; items: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    items: [
      { href: '/#features', label: 'Overview' },
      { href: '/#pricing', label: 'Pricing' },
      { href: '/#integrations', label: 'Integrations' },
    ],
  },
  {
    heading: 'Forjio family',
    items: [
      { href: 'https://huudis.com', label: 'Huudis (auth)' },
      { href: 'https://plugipay.com', label: 'Plugipay (payments)' },
      { href: 'https://storlaunch.com', label: 'Storlaunch (storefront)' },
    ],
  },
  {
    heading: 'Legal',
    items: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];
