import Link from 'next/link';
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  Briefcase,
  Check,
  ChevronDown,
  CircleDollarSign,
  Code2,
  Copy,
  Link2,
  Megaphone,
  MoreHorizontal,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Store,
  Terminal,
  Truck,
  Warehouse,
  X as XIcon,
  Zap,
} from 'lucide-react';
import { HeroBadge, SectionEyebrow } from '@forjio/website-ui';
import { LogoMark } from '@/components/brand/logo';

export default function HomePage() {
  return (
    <>
      {/* ============================================================
          HERO
          ============================================================ */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Fulkruma-specific hero backdrop — diagonal stripes (echoes
            shipping tape / pallet straps) + off-axis red radial. Distinct
            from LinkSnap's dot grid + blue radial. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,theme(colors.brand.500/0.18)_0%,transparent_50%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 [background-image:repeating-linear-gradient(45deg,hsl(var(--border))_0_1px,transparent_1px_14px)] opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-14 md:pt-20 pb-12 md:pb-16">
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
            <HeroBadge
              brandIcon={<LogoMark size={12} className="text-primary" />}
              primary="Stock + shipping"
              secondary="Forjio family, Biteship inside"
            />

            <h1 className="mt-5 text-[36px] leading-[1.05] md:text-[56px] md:leading-[1.02] font-semibold tracking-[-0.025em]">
              Stock and shipping that{' '}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">just works</span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-1 h-3 md:h-4 bg-primary/60 dark:bg-primary/30 -z-0 rounded-sm"
                />
              </span>
              <br />
              for Indonesian storefronts.
            </h1>

            <p className="mt-5 text-[15px] md:text-base leading-relaxed text-muted-foreground max-w-[60ch] mx-auto">
              Fulkruma is multi-warehouse inventory, soft-hold reservations, and
              Biteship-powered shipping — billed in Rupiah, plugged into your Storlaunch
              storefront in one click.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-brand-600 transition-colors"
              >
                Get started
                <ArrowRight className="size-4" strokeWidth={1.5} />
              </Link>
              <a
                href="#hero-mockup"
                className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg text-sm font-medium border border-border bg-card hover:border-brand-300 hover:bg-card/80 transition-colors backdrop-blur-sm"
              >
                See how it works
              </a>
            </div>

            <div className="mt-6 inline-flex items-center gap-3 rounded-md border border-border bg-card/70 px-4 py-2 font-mono text-[12px] md:text-[13px] max-w-full">
              <span className="text-primary shrink-0">SKU TSHIRT-BLK-M</span>
              <ArrowRight className="size-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <span className="text-muted-foreground truncate">
                Jakarta DC · 228 available · ships via JNE
              </span>
            </div>
          </div>

          <HeroStockPreview />
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS
          ============================================================ */}
      <section className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Up and running in an afternoon.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[52ch]">
              Three steps, no new auth, no separate billing. Free tier supports 50 fulfilled
              orders a month with no card.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                num: '01',
                Icon: Store,
                title: 'Connect a Storlaunch storefront',
                body:
                  'Enable the Fulkruma module in Storlaunch settings. Your warehouses and SKUs sync over automatically. No new logins, no separate workspace to maintain.',
              },
              {
                num: '02',
                Icon: Warehouse,
                title: 'Set per-warehouse stock levels',
                body:
                  'Receive, transfer, and adjust on-hand counts from the portal or CLI. Reservations soft-hold inventory at checkout so you never oversell during a flash sale.',
              },
              {
                num: '03',
                Icon: Truck,
                title: 'Ship with Biteship couriers',
                body:
                  'Pick a courier, mint a waybill, and stream tracking events back to your storefront. JNE, SiCepat, ID Express, J&T — all in one API.',
              },
            ].map(({ num, Icon, title, body }) => (
              <div key={num} className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center size-8 rounded-md bg-primary/10 text-primary text-[12px] font-mono font-semibold">
                    {num}
                  </span>
                  <Icon className="size-4 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURES
          ============================================================ */}
      <section className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <SectionEyebrow>Features</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Everything fulfilment, nothing else.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[52ch]">
              Six things we ship. Inventory, reservations, shipping, deliveries, addresses, and
              license keys — the shape of fulfilment as a single bounded service.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                Icon: Warehouse,
                title: 'Multi-warehouse',
                body:
                  'Track stock across many locations. Allocate orders to the closest warehouse automatically. Transfers between locations with full audit trail.',
              },
              {
                Icon: Boxes,
                title: 'Stock movements',
                body:
                  'Append-only ledger of every receipt, transfer, adjustment, and shipment. One source of truth across all warehouses, never out of sync.',
              },
              {
                Icon: ArrowLeftRight,
                title: 'Reservations',
                body:
                  'Soft-hold inventory at checkout to prevent oversell. Released automatically on payment success or expiry — no manual reconciliation.',
              },
              {
                Icon: Truck,
                title: 'Biteship shipping',
                body:
                  'JNE, SiCepat, ID Express, J&T, Anteraja, Pos Indonesia, Lion Parcel, Ninja Xpress — Indonesian couriers in one API with IDR rate cards.',
              },
              {
                Icon: PackageCheck,
                title: 'Delivery tracking',
                body:
                  'Real-time shipment events streamed back to your storefront. Buyer-facing tracking link per shipment, email + WhatsApp notification hooks.',
              },
              {
                Icon: ShieldCheck,
                title: 'License keys',
                body:
                  'Digital fulfilment for software products. Mint on payment, track activations, revoke on refund. One service for physical + digital.',
              },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="rounded-lg border border-border bg-card p-6">
                <div className="size-10 rounded-md flex items-center justify-center bg-primary/10 text-primary mb-4">
                  <Icon className="size-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          PRICING
          ============================================================ */}
      <section id="pricing" className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-16 md:pt-24">
          <div className="text-center max-w-3xl mx-auto">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Priced in Rupiah. No per-shipment fees.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[62ch] mx-auto">
              Free is genuinely free, not a trial. Pay annually for two months free.
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-12 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                name: 'Free',
                price: 'Rp 0',
                priceUnit: 'forever',
                who: 'For pilots and side projects.',
                features: [
                  '50 fulfilled orders / month',
                  '1 warehouse',
                  '1 team seat',
                  'Biteship couriers',
                  'Email support',
                ],
                cta: { label: 'Start free', href: '/login' },
              },
              {
                name: 'Starter',
                price: 'Rp 299k',
                priceUnit: '/ month',
                who: 'For growing Indonesian storefronts.',
                featured: true,
                features: [
                  '500 fulfilled orders / month',
                  '3 warehouses',
                  '3 team seats',
                  'Reservations + low-stock alerts',
                  'License keys',
                  'Full API access',
                ],
                cta: { label: 'Start 14-day trial', href: '/login?plan=starter' },
              },
              {
                name: 'Growth',
                price: 'Rp 799k',
                priceUnit: '/ month',
                who: 'For multi-warehouse merchants.',
                features: [
                  '5,000 fulfilled orders / month',
                  '10 warehouses',
                  'Multi-region routing',
                  'Higher API rate limit',
                  'Priority support',
                ],
                cta: { label: 'Talk to sales', href: '/contact' },
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-xl border p-5 flex flex-col ${
                  tier.featured
                    ? 'border-primary bg-card shadow-lg shadow-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-2.5 left-5 inline-flex items-center rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Most popular
                  </span>
                )}
                <h3 className="text-[18px] font-semibold tracking-tight">{tier.name}</h3>
                <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-snug min-h-[40px]">
                  {tier.who}
                </p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-[28px] font-bold tabular-nums tracking-tight">
                    {tier.price}
                  </span>
                  <span className="text-xs text-muted-foreground">{tier.priceUnit}</span>
                </div>
                <ul className="mt-5 space-y-2 flex-1">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-[12.5px] text-foreground/90 leading-[1.4]"
                    >
                      <Check
                        className="size-3.5 mt-0.5 shrink-0 text-primary"
                        strokeWidth={2.25}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.cta.href}
                  className={`mt-6 inline-flex items-center justify-center w-full h-9 px-4 rounded-md text-sm font-medium transition-colors ${
                    tier.featured
                      ? 'bg-primary text-primary-foreground hover:bg-brand-600'
                      : 'bg-card border border-border hover:border-brand-300'
                  }`}
                >
                  {tier.cta.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          COMPARISON
          ============================================================ */}
      <section className="border-b border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="text-center max-w-2xl mx-auto">
            <SectionEyebrow>Compare</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Built for Indonesia. Not retrofit.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[60ch] mx-auto">
              You get the warehouse, the couriers, the no-oversell guarantee — and a real CLI
              when you want to wire it into your stack.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Capability
                    </th>
                    <th className="px-4 py-3 font-semibold text-primary">Fulkruma</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">In-house</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Shipmondo</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cap: 'Lowest paid tier', s: 'Rp 299k/mo', sh: 'engineer time', m: '~Rp 800k/mo (€50)' },
                    { cap: 'IDR billing', s: true, sh: true, m: false },
                    { cap: 'Multi-warehouse routing', s: true, sh: 'maybe', m: false },
                    { cap: 'Reservations / no-oversell', s: true, sh: 'maybe', m: false },
                    { cap: 'Indonesian courier coverage', s: true, sh: false, m: false },
                    { cap: 'API + CLI + SDKs', s: true, sh: false, m: false },
                    { cap: 'License-key digital fulfilment', s: true, sh: false, m: false },
                    { cap: 'Native Storlaunch / Plugipay integration', s: true, sh: false, m: false },
                    { cap: 'One login for sister products', s: true, sh: false, m: false },
                  ].map((row) => (
                    <tr key={row.cap} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 text-foreground/90">{row.cap}</td>
                      <Cell value={row.s} highlight />
                      <Cell value={row.sh} />
                      <Cell value={row.m} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOR DEVELOPERS
          ============================================================ */}
      <section className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-start">
            <div>
              <SectionEyebrow>For developers</SectionEyebrow>
              <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
                CLI-first. Type-safe SDKs. Webhooks that don&apos;t lie.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[52ch]">
                Real CLI, type-safe SDKs for Node.js, Python, and Go, REST API, signed webhooks,
                idempotency keys, and a sandbox mode. Test before flipping a single real waybill.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Receive, transfer, ship — all scriptable from the CLI',
                  'OpenAPI spec + type-safe SDKs (Node, Python, Go)',
                  'Webhooks with HMAC signatures + replay protection',
                  'Sandbox mode with disposable test workspaces',
                ].map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-sm text-foreground/90 leading-relaxed"
                  >
                    <Check className="size-4 mt-0.5 shrink-0 text-primary" strokeWidth={2.25} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-brand-600 transition-colors"
                >
                  Read the docs
                  <ArrowRight className="size-4" strokeWidth={1.5} />
                </Link>
                <a
                  href="https://github.com/hachimi-cat/saas-fulkruma"
                  className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-medium border border-border bg-card hover:border-brand-300 transition-colors"
                >
                  <Code2 className="size-4" strokeWidth={1.5} />
                  View SDK on GitHub
                </a>
              </div>
            </div>

            <div className="space-y-4">
              <TerminalCard label="fulkruma — sandbox">
                <span className="text-white/40"># Install once</span>
                {'\n'}
                <span className="text-white/90">$ npm i -g @forjio/fulkruma-cli</span>
                {'\n\n'}
                <span className="text-white/40"># Log in with your Forjio account</span>
                {'\n'}
                <span className="text-white/90">$ fulkruma auth login</span>
                {'\n'}
                <span className="text-green-300">✔ Authenticated as you@example.com via Huudis</span>
                {'\n\n'}
                <span className="text-white/40"># Receive 50 units into Jakarta DC</span>
                {'\n'}
                <span className="text-white/90">$ fulkruma stock receive \</span>
                {'\n'}
                <span className="text-white/90">
                  {'    --sku TSHIRT-BLK-M --warehouse jkt --qty 50'}
                </span>
                {'\n'}
                <span className="text-green-300">✔ On-hand: 240 → 290 (Jakarta DC)</span>
              </TerminalCard>

              <TerminalCard label="ship.ts">
                <span className="text-purple-300">import</span>
                <span className="text-white/90">{' { Fulkruma } '}</span>
                <span className="text-purple-300">from</span>
                <span className="text-green-300">{' "@forjio/fulkruma-node"'}</span>
                <span className="text-white/90">;</span>
                {'\n\n'}
                <span className="text-purple-300">const</span>
                <span className="text-white/90">{' fulkruma = '}</span>
                <span className="text-purple-300">new</span>
                <span className="text-white/90">{' Fulkruma({'}</span>
                {'\n'}
                <span className="text-white/90">{'  apiKey: process.env.FULKRUMA_KEY!,'}</span>
                {'\n'}
                <span className="text-white/90">{'});'}</span>
                {'\n\n'}
                <span className="text-purple-300">const</span>
                <span className="text-white/90">{' shipment = '}</span>
                <span className="text-purple-300">await</span>
                <span className="text-white/90">{' fulkruma.shipments.create({'}</span>
                {'\n'}
                <span className="text-white/90">{'  orderId: '}</span>
                <span className="text-green-300">{'"ord_8H2k"'}</span>
                <span className="text-white/90">,</span>
                {'\n'}
                <span className="text-white/90">{'  courier: '}</span>
                <span className="text-green-300">{'"jne"'}</span>
                <span className="text-white/90">,</span>
                {'\n'}
                <span className="text-white/90">{'});'}</span>
                {'\n\n'}
                <span className="text-white/90">console.log(shipment.waybill);</span>
                <span className="text-white/40"> {'// JNE-0001-...'}</span>
              </TerminalCard>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FORJIO FAMILY
          ============================================================ */}
      <section className="border-b border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="text-center max-w-3xl mx-auto">
            <SectionEyebrow>One login</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Sign in once. Use every Forjio product.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[60ch] mx-auto">
              Fulkruma shares its account system with the rest of the Forjio family through Huudis
              SSO. Add a teammate to Fulkruma and they&apos;re already part of your other Forjio
              workspaces.
            </p>
          </div>

          <div className="mt-12 max-w-2xl mx-auto">
            <div className="rounded-xl border border-border bg-card shadow-sm p-8">
              <div className="flex flex-col items-center">
                <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 mb-2">
                  <ShieldCheck className="size-7" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-foreground">Huudis</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">identity</p>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3">
                {[
                  { name: 'Fulkruma', icon: Truck, current: true, label: 'fulfilment' },
                  { name: 'Storlaunch', icon: Zap, label: 'storefront' },
                  { name: 'Plugipay', icon: CircleDollarSign, label: 'payments' },
                  { name: 'LinkSnap', icon: Link2, label: 'links + QR' },
                  { name: 'Ripllo', icon: Megaphone, label: 'marketing' },
                  { name: 'Serront', icon: Briefcase, label: 'service invoicing' },
                  { name: 'Malapos', icon: Store, label: 'POS' },
                  { name: 'Suppuo', icon: Sparkles, label: 'support' },
                ].map((p) => (
                  <div
                    key={p.name}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 ${
                      p.current
                        ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-card/40'
                    }`}
                  >
                    <p.icon
                      className={`size-5 ${
                        p.current ? 'text-primary' : 'text-muted-foreground'
                      }`}
                      strokeWidth={1.5}
                    />
                    <span className="text-[10.5px] font-medium leading-tight">{p.name}</span>
                    <span className="text-[9px] text-muted-foreground leading-tight text-center">
                      {p.label}
                    </span>
                    {p.current && (
                      <span className="text-[9px] font-mono text-primary">you are here</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-6 text-sm text-muted-foreground text-center">
              Powered by{' '}
              <a
                href="https://huudis.com"
                className="text-primary hover:underline font-medium"
              >
                Huudis
              </a>{' '}
              — the identity provider for the Forjio family.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          FAQ
          ============================================================ */}
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Common questions.
            </h2>
          </div>

          <ul className="mt-10 divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
            {[
              {
                q: 'Do I need a Storlaunch storefront to use Fulkruma?',
                a:
                  'No — Fulkruma has its own portal and a REST API + CLI. But the smoothest path is Storlaunch, which enables Fulkruma as a one-click module and rolls billing into one invoice via the Pattern 2 partner-billing model.',
              },
              {
                q: 'Which couriers are supported?',
                a:
                  'JNE, SiCepat, ID Express, J&T, Anteraja, Pos Indonesia, Lion Parcel, and Ninja Xpress at launch — via Biteship. International couriers (DHL, FedEx) come after M5.',
              },
              {
                q: 'How does pricing work for Storlaunch merchants?',
                a:
                  'Storlaunch bundles Fulkruma usage into your Storlaunch bill via the Pattern 2 partner-billing model. You see one line item; Fulkruma settles B2B with Storlaunch behind the scenes.',
              },
              {
                q: 'Is my data multi-tenant safe?',
                a:
                  'Yes. Every Fulkruma row is scoped to a Huudis account. Per-tenant API tokens, no cross-tenant SQL — see the forjio-architecture ADRs for the full isolation model.',
              },
              {
                q: 'What happens if I downgrade from Starter to Free?',
                a:
                  'Existing warehouses stay live. The Free tier limits apply only to new orders going forward. Reservations + low-stock alerts switch off; license-key issuance pauses on the new orders only.',
              },
              {
                q: 'Can I run Fulkruma without Plugipay or the Forjio family?',
                a:
                  'Fulkruma stand-alone is supported but unsupported as a primary path — pricing, reservations, and refund flows assume payment events arrive over the outbox from Plugipay.',
              },
              {
                q: 'Does Fulkruma handle digital products too?',
                a:
                  'Yes — license keys, activations, and revocation. One service for both physical fulfilment and digital fulfilment, so you don&apos;t have to maintain two billing stacks.',
              },
            ].map((faq) => (
              <li key={faq.q}>
                <details className="group">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-6 py-5 hover:bg-muted/30 transition-colors [&::-webkit-details-marker]:hidden">
                    <span className="text-[15px] font-medium text-foreground">{faq.q}</span>
                    <ChevronDown
                      className="size-4 text-muted-foreground transition-transform group-open:rotate-180 shrink-0"
                      strokeWidth={1.5}
                    />
                  </summary>
                  <div className="px-6 pb-5 -mt-1 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================
          FOOTER CTA
          ============================================================ */}
      <section className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 md:py-20 text-center">
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary mb-6">
              <Truck className="size-6" strokeWidth={2} />
            </div>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em] max-w-[24ch]">
              Stop reconciling spreadsheets. Start shipping.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[52ch]">
              Free forever for 50 fulfilled orders a month. No card. Upgrade when you outgrow it.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-brand-600 transition-colors"
              >
                Get started
                <ArrowRight className="size-4" strokeWidth={1.5} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-medium border border-border bg-card hover:border-brand-300 transition-colors"
              >
                Talk to a human
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function Cell({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (typeof value === 'string') {
    return (
      <td
        className={`px-4 py-3 text-center text-[13px] ${
          highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'
        }`}
      >
        {value}
      </td>
    );
  }
  return (
    <td className="px-4 py-3 text-center">
      {value ? (
        <Check
          className={`size-4 mx-auto ${highlight ? 'text-primary' : 'text-foreground/60'}`}
          strokeWidth={2.25}
        />
      ) : (
        <XIcon className="size-4 mx-auto text-muted-foreground/40" strokeWidth={1.5} />
      )}
    </td>
  );
}

function HeroStockPreview() {
  // Mini sparkline data — fulfilled-orders-per-day (12 points)
  const sparkPoints = [14, 18, 16, 24, 30, 27, 36, 38, 47, 53, 49, 62];
  const max = Math.max(...sparkPoints);
  const sparkPath = sparkPoints
    .map((v, i) => {
      const x = (i / (sparkPoints.length - 1)) * 200;
      const y = 36 - (v / max) * 32;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div id="hero-mockup" className="mt-12 md:mt-14 max-w-2xl mx-auto">
      <div className="rounded-xl border border-border bg-card shadow-lg shadow-primary/5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-500/70" />
            <span className="size-2.5 rounded-full bg-amber-400/70" />
            <span className="size-2.5 rounded-full bg-primary/70" />
            <Warehouse className="ml-2 size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-[11px] text-muted-foreground font-mono">
              fulkruma / warehouses / jakarta-dc / stock
            </span>
          </div>
          <MoreHorizontal className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-start">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-mono font-semibold text-primary truncate">
                TSHIRT-BLK-M · Jakarta DC
              </span>
              <button className="text-muted-foreground hover:text-foreground shrink-0">
                <Copy className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
            <p className="mt-1 text-[12px] font-mono text-muted-foreground truncate">
              → 228 available · 12 reserved · 240 on-hand
            </p>

            <div className="mt-4">
              <svg
                width="100%"
                height="36"
                viewBox="0 0 200 36"
                preserveAspectRatio="none"
                className="overflow-visible"
              >
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${sparkPath} L 200 36 L 0 36 Z`}
                  fill="url(#sparkFill)"
                />
                <path
                  d={sparkPath}
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 text-[11px] font-mono">
              <div>
                <span className="text-muted-foreground uppercase">Shipped</span>
                <div className="text-foreground text-[15px] font-semibold tabular-nums">1,247</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase">Today</span>
                <div className="text-foreground text-[15px] font-semibold tabular-nums">+82</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase">Top courier</span>
                <div className="text-foreground text-[15px] font-semibold">JNE</div>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-center gap-2">
            <div className="rounded-lg border border-border bg-background p-2.5">
              <div className="size-24 grid grid-cols-4 grid-rows-4 gap-0.5">
                {/* Stylised waybill-grid: 16 cells, some filled, evokes a
                    pick-list / pallet layout. Distinct from LinkSnap's QR. */}
                {[1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0].map((on, i) => (
                  <span
                    key={i}
                    className={`rounded-sm ${on ? 'bg-primary/80' : 'bg-muted'}`}
                  />
                ))}
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-mono text-primary">
                <Truck className="size-2.5" strokeWidth={2} />
                <span>waybill · JNE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground text-center">
        Every fulfilled order gets a waybill + real-time tracking. Your stock, in IDR pricing.
      </p>
    </div>
  );
}

function TerminalCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-px rounded-xl bg-gradient-to-br from-primary/20 via-transparent to-transparent dark:from-primary/10 blur-sm"
      />
      <div className="relative rounded-xl border border-slate-900/90 bg-[#0B0F1A] shadow-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-3.5 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-red-500/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-primary/80" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/50 font-mono">
            <Terminal className="size-3 text-primary" strokeWidth={1.5} />
            {label}
          </div>
          <span className="text-[11px] text-white/30 font-mono">zsh</span>
        </div>
        <pre className="px-4 py-4 text-[12px] leading-[1.7] font-mono whitespace-pre-wrap break-words">
          {children}
        </pre>
      </div>
    </div>
  );
}
