import type { Metadata } from 'next';
import { Mail, Phone, MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact — Fulkruma',
  description: 'Get in touch with the Fulkruma team. Support, sales, partnerships, legal, privacy.',
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Contact</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Support, sales, partnerships, legal, privacy — all routed to one mailbox so nothing slips
        through.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Card icon={<Mail size={18} className="text-brand-600" />} label="Email" value="support@forjio.com" href="mailto:support@forjio.com">
          Response within 1 business day. Tag the subject [support] / [sales] / [legal] / [privacy] to help us route faster.
        </Card>
        <Card icon={<Phone size={18} className="text-brand-600" />} label="Phone / WhatsApp" value="+62 815-2999-0219" href="tel:+6281529990219">
          Mon–Fri, 09:00–17:00 WIB.
        </Card>
        <Card
          icon={<MapPin size={18} className="text-brand-600" />}
          label="Registered address"
          value={
            <>
              Jl. Parkit, Blok I, No. 48,
              <br />
              RT 004, RW 001,
              <br />
              Cempaka Permai, Gading Cempaka,
              <br />
              Bengkulu, Bengkulu 38221
            </>
          }
        >
          PT Forjio Teknologi Indonesia
        </Card>
      </div>

      <div className="mt-10 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">What to send for a faster reply</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li><strong>Customer support</strong> — your account email, the workspace name, and a screenshot or error code.</li>
          <li><strong>Billing / refund</strong> — invoice number or charge date, plus the reason. See our <a href="/refund" className="text-brand-600 hover:underline">Refund Policy</a>.</li>
          <li><strong>Privacy / data subject requests</strong> — the action you want and the email tied to your account. We respond within 30 days under UU PDP.</li>
          <li><strong>Legal notices / takedowns</strong> — please use a subject line starting with [legal].</li>
        </ul>
      </div>
    </main>
  );
}

function Card({
  icon,
  label,
  value,
  href,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-base font-medium">
        {href ? (
          <a className="hover:underline" href={href}>
            {value}
          </a>
        ) : (
          value
        )}
      </div>
      {children ? <p className="mt-2 text-xs text-muted-foreground">{children}</p> : null}
    </div>
  );
}
