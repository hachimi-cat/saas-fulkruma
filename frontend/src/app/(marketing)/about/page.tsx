import type { Metadata } from 'next';
import { LogoMark } from '@/components/brand/logo';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Fulkruma is the stock + shipping service of the Forjio commerce family. Built for Indonesian storefronts.',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <LogoMark size={36} />
          <h1 className="text-4xl font-bold tracking-tight">About Fulkruma</h1>
        </div>

        <div className="mt-10 space-y-6 text-muted-foreground">
          <p className="text-lg">
            Fulkruma exists because Indonesian merchants kept stitching their own
            warehouse + Biteship integrations together — and getting it wrong.
          </p>

          <p>
            We&apos;re part of the <strong className="text-foreground">Forjio family</strong>:
            a set of products that share one identity (Huudis), one payment layer
            (Plugipay), and one storefront engine (Storlaunch). Fulkruma is the
            fulfilment piece — multi-warehouse inventory, soft-hold reservations,
            Biteship-powered shipping, delivery tracking, and license keys for
            digital goods.
          </p>

          <p>
            Storefront merchants on Storlaunch get Fulkruma as a one-click module
            via the Pattern 2 partner-billing model — usage rolls into the
            Storlaunch invoice. Stand-alone? Fulkruma has its own portal, REST API,
            and CLI.
          </p>

          <h2 className="pt-6 text-xl font-semibold text-foreground">Built for Indonesia</h2>
          <p>
            IDR-primary pricing. Native Biteship integration. PT Forjio Teknologi
            Indonesia is the registered operating entity. We pay tax here, we
            support here, and we respond to UU PDP requests within 30 days.
          </p>

          <h2 className="pt-6 text-xl font-semibold text-foreground">The Forjio family</h2>
          <p>
            Fulkruma is one of seven Forjio products — alongside Huudis (auth),
            Plugipay (payments), Storlaunch (storefront), Ripllo (marketing &amp;
            retention), Malapos (point of sale), and Suppuo (customer support).
            One login, one bill, modules that combine to fit your business.
          </p>
        </div>
      </div>
    </div>
  );
}
