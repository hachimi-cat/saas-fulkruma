import { Wallet } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function BillingPage() {
  return (
    <EmptySection
      title="Billing"
      description="Plan, invoices, and payment method. Fulkruma billing rolls up via Plugipay (Pattern 2 partner billing) — wires up in Phase F."
      icon={Wallet}
    />
  );
}
