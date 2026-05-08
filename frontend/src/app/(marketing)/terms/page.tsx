import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Fulkruma',
  description: 'Terms governing your use of Fulkruma stock and shipping infrastructure.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective: 8 May 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Agreement</h2>
          <p className="mt-3">
            These Terms govern your use of Fulkruma, operated by{' '}
            <strong>PT Forjio Teknologi Indonesia</strong>. By creating an account or using
            Fulkruma you agree to these Terms.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Service description</h2>
          <p className="mt-3">
            Fulkruma is a stock and shipping platform that integrates with Indonesian carriers
            (Biteship and others), manages warehouse inventory, ships orders, and emits events for
            downstream services in the Forjio family.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Eligibility</h2>
          <p className="mt-3">
            You must be at least 18 years old, operate a legitimate business, and comply with
            applicable Indonesian shipping regulations.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Fees and refunds</h2>
          <p className="mt-3">
            Fulkruma is sold via subscription. Carrier fees pass through at carrier rates.
            Subscription refunds are governed by our{' '}
            <a href="/refund" className="text-brand-600 hover:underline">Refund Policy</a>.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Acceptable use</h2>
          <p className="mt-3">
            You may not ship prohibited goods, violate carrier terms, or use Fulkruma to facilitate
            unlawful activity.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Liability</h2>
          <p className="mt-3">
            To the maximum extent permitted by Indonesian law, Fulkruma is not liable for indirect,
            incidental, or consequential damages, lost profits, or data-loss costs. Total liability
            is capped at fees paid in the three months before the claim. Carrier-caused losses are
            handled per the carrier's policy.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Termination</h2>
          <p className="mt-3">
            You may close your account at any time. We may suspend or terminate accounts for
            material breach, fraud, or non-payment after 14 days of notice.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Governing law</h2>
          <p className="mt-3">
            These Terms are governed by the laws of the Republic of Indonesia. Disputes shall be
            resolved through good-faith negotiation; if that fails within 30 days, disputes shall
            be submitted to the District Court of Bengkulu (Pengadilan Negeri Bengkulu).
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Legal Entity & Contact</h2>
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
            <a href="mailto:support@forjio.com" className="text-brand-600 hover:underline">support@forjio.com</a>{' '}
            (subject line tag: [legal])
          </p>
        </section>
      </div>
    </main>
  );
}
