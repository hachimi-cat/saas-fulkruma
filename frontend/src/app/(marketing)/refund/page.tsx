import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy — Fulkruma',
  description: 'Fulkruma refund policy for subscription fees.',
};

export default function RefundPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Refund Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective: 8 May 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Subscription fees</h2>
          <p className="mt-3">
            Fulkruma sells access to the platform via monthly and annual subscription plans.
            Subscription fees are charged in advance for the upcoming billing period and are
            non-refundable for the current period once the period has started. You can cancel
            from your dashboard at any time — cancellation stops the next renewal.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">2. When we will issue a refund</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li><strong>Duplicate charges</strong> — refunded within 7 business days of confirmation.</li>
            <li><strong>Service unavailable for &gt;24 consecutive hours</strong> due to an issue on our side — pro-rated credit or refund on request.</li>
            <li><strong>Charged after cancellation</strong> — refunded in full within 7 business days.</li>
            <li><strong>Unauthorised charges</strong> — contact support immediately; we work with the payment provider to resolve.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">3. When we will not issue a refund</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Partial-period cancellation — current period was consumed; no mid-cycle pro-rata.</li>
            <li>Change of mind after the trial period.</li>
            <li>Failure to use the service.</li>
            <li>Plan downgrades — new tier applies from the next renewal.</li>
            <li>Annual plans cancelled mid-year — current 12-month period not refunded.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Carrier shipping fees</h2>
          <p className="mt-3">
            Fulkruma passes through carrier shipping fees at the carrier's published rate. Refunds
            on those carrier fees are governed by the carrier's policy (e.g. Biteship). Fulkruma
            assists with claim filing but does not adjudicate carrier disputes.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">5. How to request a refund</h2>
          <p className="mt-3">
            Email{' '}
            <a href="mailto:support@forjio.com" className="text-brand-600 hover:underline">
              support@forjio.com
            </a>{' '}
            with the account email, the invoice number or charge date, and the reason. We respond
            within 2 business days. Approved refunds are issued to the original payment method
            within 7 business days.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Contact</h2>
          <p className="mt-3">
            <strong>PT Forjio Teknologi Indonesia</strong>
            <br />
            Jl. Parkit, Blok I, No. 48, RT 004, RW 001, Cempaka Permai, Gading Cempaka, Bengkulu,
            Bengkulu 38221
            <br />
            Phone / WhatsApp:{' '}
            <a href="tel:+6281529990219" className="text-brand-600 hover:underline">+62 815-2999-0219</a>
            <br />
            Email:{' '}
            <a href="mailto:support@forjio.com" className="text-brand-600 hover:underline">support@forjio.com</a>
          </p>
        </section>
      </div>
    </main>
  );
}
