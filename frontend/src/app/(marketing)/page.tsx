import Link from 'next/link';
import {
  Truck,
  Boxes,
  Warehouse,
  ArrowRight,
  Check,
  CircleX,
  PackageCheck,
  ShieldCheck,
  Zap,
  Wallet,
  ArrowLeftRight,
  Plug,
  Sparkles,
} from 'lucide-react';

export default function MarketingLandingPage() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <Features />
      <Integrations />
      <Pricing />
      <Comparison />
      <Family />
      <FAQ />
      <FooterCta />
    </main>
  );
}

// 1 — Hero ----------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <BackdropGrid />
      <div className="relative mx-auto max-w-3xl px-6 pb-12 pt-20 text-center sm:pt-28">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-brand-700 shadow-xs">
          <Sparkles size={12} /> Forjio family · M5
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          Stock and shipping that <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">just works</span> for Indonesian storefronts.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          Multi-warehouse inventory, soft-hold reservations, and Biteship-powered shipping —
          billed in Rupiah, plugged into your Storlaunch storefront in one click.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-brand-600 transition"
          >
            Get started <ArrowRight size={14} />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-secondary transition"
          >
            See how it works
          </a>
        </div>
        <p className="mt-6 inline-flex items-center gap-x-4 gap-y-1 flex-wrap justify-center text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Check size={12} className="text-brand-500" /> Biteship couriers</span>
          <span className="inline-flex items-center gap-1"><Check size={12} className="text-brand-500" /> Multi-warehouse</span>
          <span className="inline-flex items-center gap-1"><Check size={12} className="text-brand-500" /> No-oversell guarantee</span>
        </p>

        <HeroMockup />
      </div>
    </section>
  );
}

function BackdropGrid() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(11,15,26,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(11,15,26,0.04)_1px,transparent_1px)] bg-[size:48px_48px]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(242,47,70,0.12),transparent_60%)]"
      />
    </>
  );
}

function HeroMockup() {
  return (
    <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-border bg-card p-2 shadow-lg">
      <div className="rounded-xl border border-border bg-background p-5 text-left">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Stock · Jakarta DC · today
          </p>
          <span className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[10px]">
            live
          </span>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 text-left font-medium">SKU</th>
              <th className="pb-2 text-right font-medium">On-hand</th>
              <th className="pb-2 text-right font-medium">Reserved</th>
              <th className="pb-2 text-right font-medium">Available</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px] tabular-nums">
            {[
              ['TSHIRT-BLK-M', 240, 12, 228],
              ['TSHIRT-WHT-L', 18, 4, 14, 'low'],
              ['HOODIE-NAV-M', 96, 8, 88],
              ['CAP-RED-OS', 142, 0, 142],
            ].map(([sku, oh, rsv, av, tag]) => (
              <tr key={sku as string} className="border-t border-border">
                <td className="py-2 text-foreground">{sku as string}</td>
                <td className="py-2 text-right">{oh as number}</td>
                <td className="py-2 text-right text-muted-foreground">{rsv as number}</td>
                <td className="py-2 text-right">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      tag === 'low' ? 'text-brand-700' : ''
                    }`}
                  >
                    {av as number}
                    {tag === 'low' && (
                      <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                        low
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>4 SKUs · 3 warehouses</span>
          <span className="font-mono">Biteship · JNE · SiCepat · ID Express</span>
        </div>
      </div>
    </div>
  );
}

// 2 — How it works --------------------------------------------------------

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Connect a Storlaunch storefront',
      body: 'Enable the Fulkruma module in Storlaunch settings. Your warehouses and SKUs sync over.',
    },
    {
      n: '02',
      title: 'Set per-warehouse stock levels',
      body: 'Receive, transfer, and adjust on-hand. Reservations soft-hold inventory at checkout.',
    },
    {
      n: '03',
      title: 'Ship with Biteship couriers',
      body: 'Pick a courier, mint a waybill, and send tracking events back to your storefront.',
    },
  ];
  return (
    <section id="how" className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeading
          eyebrow="How it works"
          title="Up and running in an afternoon"
          sub="Fulkruma plugs into your existing Storlaunch + Plugipay setup. No new auth, no separate billing."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl border border-border bg-card p-6">
              <span className="font-mono text-[11px] tracking-wider text-brand-700">{s.n}</span>
              <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 3 — Features ------------------------------------------------------------

function Features() {
  const items = [
    { icon: Warehouse, title: 'Multi-warehouse', body: 'Track stock across many locations. Allocate orders to the closest warehouse automatically.' },
    { icon: Boxes, title: 'Stock movements', body: 'Append-only ledger of every receipt, transfer, adjustment, and shipment. One source of truth.' },
    { icon: ArrowLeftRight, title: 'Reservations', body: 'Soft-hold inventory at checkout to prevent oversell. Released on payment success or expiry.' },
    { icon: Truck, title: 'Biteship shipping', body: 'JNE, SiCepat, ID Express, J&T, Anteraja, Pos. Indonesian couriers in one API.' },
    { icon: PackageCheck, title: 'Delivery tracking', body: 'Real-time shipment events streamed back to your storefront for buyer-facing tracking.' },
    { icon: ShieldCheck, title: 'License keys', body: 'Digital fulfilment for software products. Mint on payment, track activations, revoke on refund.' },
  ];
  return (
    <section id="features" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Features"
          title="Everything fulfilment, nothing else"
          sub="Inventory, addresses, shipments, deliveries, licenses. The shape of fulfilment as a single bounded service."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon size={18} strokeWidth={2} />
              </span>
              <h3 className="mt-3 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 4 — Integrations --------------------------------------------------------

function Integrations() {
  const couriers = ['JNE', 'SiCepat', 'ID Express', 'J&T', 'Anteraja', 'Pos Indonesia', 'Lion Parcel', 'Ninja Xpress'];
  return (
    <section id="integrations" className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeading
          eyebrow="Integrations"
          title="Indonesian couriers, all in one place"
          sub="Biteship handles courier negotiation, rate cards, and pickup scheduling. Fulkruma drives it from your storefront."
        />
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {couriers.map((c) => (
            <span
              key={c}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
            >
              {c}
            </span>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by <span className="font-medium text-foreground">Biteship</span>. International couriers (DHL, FedEx) coming after M5.
        </p>
      </div>
    </section>
  );
}

// 5 — Pricing -------------------------------------------------------------

function Pricing() {
  const tiers = [
    {
      name: 'Free',
      price: 'Rp 0',
      sub: 'up to 50 orders/mo',
      features: ['1 warehouse', '50 fulfilled orders', 'Biteship couriers', 'Email support'],
      cta: 'Get started',
    },
    {
      name: 'Starter',
      price: 'Rp 299k',
      sub: 'per month',
      features: ['3 warehouses', '500 orders/mo', 'Reservations + low-stock alerts', 'License keys'],
      cta: 'Start Starter',
      popular: true,
    },
    {
      name: 'Growth',
      price: 'Rp 799k',
      sub: 'per month',
      features: ['10 warehouses', '5,000 orders/mo', 'Multi-region routing', 'Priority support'],
      cta: 'Start Growth',
    },
    {
      name: 'Scale',
      price: 'Rp 1.999k',
      sub: 'per month',
      features: ['Unlimited warehouses', '50,000 orders/mo', 'Custom courier rates', 'SLA'],
      cta: 'Talk to sales',
    },
  ];
  return (
    <section id="pricing" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Pricing"
          title="Priced in Rupiah. No per-shipment fees."
          sub="Storlaunch storefronts get Fulkruma at Storlaunch's bundled rate via the Pattern 2 partner-billing model."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-xl border bg-card p-6 ${
                t.popular ? 'border-brand-500 shadow-md' : 'border-border'
              }`}
            >
              {t.popular && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-brand-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  Most popular
                </span>
              )}
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">{t.price}</p>
              <p className="text-xs text-muted-foreground">{t.sub}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-brand-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-6 inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition ${
                  t.popular
                    ? 'bg-primary text-primary-foreground hover:bg-brand-600'
                    : 'border border-border bg-card hover:bg-secondary'
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          All plans IDR-primary. Annual billing = 2 months free.
        </p>
      </div>
    </section>
  );
}

// 6 — Comparison ----------------------------------------------------------

function Comparison() {
  const rows = [
    { feature: 'Multi-warehouse routing', f: true, in_house: 'maybe', shipmondo: true, easyparcel: false },
    { feature: 'Reservations / no-oversell', f: true, in_house: 'maybe', shipmondo: false, easyparcel: false },
    { feature: 'Indonesian courier coverage', f: true, in_house: false, shipmondo: false, easyparcel: 'partial' },
    { feature: 'IDR billing', f: true, in_house: false, shipmondo: false, easyparcel: false },
    { feature: 'Native Storlaunch / Plugipay integration', f: true, in_house: false, shipmondo: false, easyparcel: false },
    { feature: 'License-key digital fulfilment', f: true, in_house: false, shipmondo: false, easyparcel: false },
  ];
  return (
    <section className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeading
          eyebrow="Comparison"
          title="Why Fulkruma vs. the alternatives"
          sub="Built for Indonesian storefronts. Not retrofit from a generic global SaaS."
        />
        <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Feature</th>
                <th className="px-4 py-3 text-center font-medium text-brand-700">Fulkruma</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">In-house</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Shipmondo</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">EasyParcel</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t border-border">
                  <td className="px-4 py-3 text-left">{r.feature}</td>
                  <Cell v={r.f} />
                  <Cell v={r.in_house} />
                  <Cell v={r.shipmondo} />
                  <Cell v={r.easyparcel} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <td className="px-4 py-3 text-center"><Check size={16} className="mx-auto text-brand-500" /></td>;
  if (v === false) return <td className="px-4 py-3 text-center"><CircleX size={16} className="mx-auto text-muted-foreground/50" /></td>;
  return <td className="px-4 py-3 text-center text-xs text-muted-foreground">{v}</td>;
}

// 7 — Forjio family -------------------------------------------------------

function Family() {
  const sibs = [
    { name: 'Huudis', role: 'Auth & IAM', href: 'https://huudis.com' },
    { name: 'Plugipay', role: 'Payments', href: 'https://plugipay.com' },
    { name: 'Storlaunch', role: 'Storefront', href: 'https://storlaunch.com' },
    { name: 'Ripllo', role: 'Marketing & retention', href: 'https://ripllo.com' },
    { name: 'Malapos', role: 'Point-of-sale', href: 'https://malapos.com' },
    { name: 'Suppuo', role: 'Customer support', href: 'https://suppuo.com' },
  ];
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeading
          eyebrow="Forjio family"
          title="One identity. Six products. One bill."
          sub="Sign in once via Huudis. Pay once via Plugipay. Modules combine to fit your business."
        />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative rounded-xl border-2 border-brand-500 bg-card p-5 ring-2 ring-brand-500/20">
            <span className="absolute -top-2.5 left-4 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
              You are here
            </span>
            <p className="text-sm font-semibold">Fulkruma</p>
            <p className="mt-1 text-xs text-muted-foreground">Stock & shipping</p>
          </div>
          {sibs.map((s) => (
            <a
              key={s.name}
              href={s.href}
              className="rounded-xl border border-border bg-card p-5 transition hover:border-brand-300 hover:shadow-sm"
            >
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.role}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// 8 — FAQ -----------------------------------------------------------------

function FAQ() {
  const qs = [
    {
      q: 'Do I need a Storlaunch storefront to use Fulkruma?',
      a: 'No — Fulkruma has its own portal and a REST API + CLI. But the smoothest path is Storlaunch, which enables Fulkruma as a one-click module and rolls billing into one invoice.',
    },
    {
      q: 'Which couriers are supported?',
      a: 'JNE, SiCepat, ID Express, J&T, Anteraja, Pos Indonesia, Lion Parcel, and Ninja Xpress at launch — via Biteship. International couriers come after M5.',
    },
    {
      q: 'How does pricing work for Storlaunch merchants?',
      a: 'Storlaunch bundles Fulkruma usage into your Storlaunch bill via the Pattern 2 partner-billing model. You see one line item; Fulkruma settles B2B with Storlaunch.',
    },
    {
      q: 'Is my data multi-tenant safe?',
      a: 'Yes. Every Fulkruma row is scoped to a Huudis account. Per-tenant API tokens, no cross-tenant SQL — see the forjio-architecture ADRs for the full model.',
    },
    {
      q: 'Can I run this without Plugipay or the Forjio family?',
      a: 'Fulkruma stand-alone is supported but unsupported as a primary path — pricing, reservations, and refund flows assume payment events arrive over the outbox from Plugipay.',
    },
    {
      q: 'Does Fulkruma handle digital products too?',
      a: 'Yes — license keys, activations, and revocation. One service for both physical fulfilment and digital fulfilment.',
    },
  ];
  return (
    <section id="faq" className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions"
          sub="Don't see your question? Email support@fulkruma.com."
        />
        <div className="mt-10 divide-y divide-border rounded-xl border border-border bg-card">
          {qs.map((item) => (
            <details key={item.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground">
                {item.q}
                <span className="ml-4 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// 9 — Footer CTA ----------------------------------------------------------

function FooterCta() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
          <Truck size={20} />
        </span>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          Stop reconciling spreadsheets. Start shipping.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Fulkruma is part of the Forjio family — same Huudis sign-in, same Plugipay billing.
          Up and running in an afternoon.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-brand-600 transition"
          >
            Get started <ArrowRight size={14} />
          </Link>
          <a
            href="https://github.com/hachimi-cat/saas-fulkruma"
            className="inline-flex items-center rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-secondary transition"
          >
            View source
          </a>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          Auth via Huudis · Payments via Plugipay · Couriers via Biteship
        </p>
      </div>
    </section>
  );
}

// shared ------------------------------------------------------------------

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-700">{eyebrow}</span>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">{sub}</p>
    </div>
  );
}

// keep imports tree-shaken happy if any get unused
void Zap;
void Wallet;
void Plug;
