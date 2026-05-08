import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Fulkruma',
  description: 'How Fulkruma collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective: 8 May 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. What we collect</h2>
          <p className="mt-3">
            Account email and name (via Huudis SSO), warehouse and stock records you create,
            shipping addresses for orders, carrier tracking events, and aggregate usage logs for
            security and reliability.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">2. How we use it</h2>
          <p className="mt-3">
            To provide the service, route shipments via carriers (Biteship and others), bill
            usage via Plugipay, secure your account, and improve product quality. We do not sell
            your data.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Data sharing</h2>
          <p className="mt-3">
            Carrier addresses are shared with the chosen carrier to fulfill shipments. Billing
            data flows to Plugipay (the underlying payment provider). Identity flows to Huudis
            (the auth provider). No other third-party sharing.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Retention</h2>
          <p className="mt-3">
            Active account data is retained while your account is open. Transaction and shipment
            records are retained for 5 years per Indonesian law. You may request export or
            deletion at any time.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Your rights</h2>
          <p className="mt-3">
            Under UU No. 27/2022 (Pelindungan Data Pribadi) you have rights of access,
            correction, deletion, portability, and objection. Email{' '}
            <a href="mailto:support@forjio.com" className="text-brand-600 hover:underline">
              support@forjio.com
            </a>{' '}
            with subject line tag [privacy] to exercise them. We respond within 30 days.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Cookies</h2>
          <p className="mt-3">
            The dashboard uses session cookies for authentication. The marketing site uses no
            third-party tracking cookies.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Data Controller & Contact</h2>
          <p className="mt-3">
            <strong>PT Forjio Teknologi Indonesia</strong>
            <br />
            Jl. Parkit, Blok I, No. 48, RT 004, RW 001, Cempaka Permai, Gading Cempaka, Bengkulu,
            Bengkulu 38221
            <br />
            Phone:{' '}
            <a href="tel:+6281529990219" className="text-brand-600 hover:underline">+62 815-2999-0219</a>
            <br />
            Email:{' '}
            <a href="mailto:support@forjio.com" className="text-brand-600 hover:underline">support@forjio.com</a>{' '}
            (subject line tag: [privacy])
          </p>
        </section>
      </div>
    </main>
  );
}
