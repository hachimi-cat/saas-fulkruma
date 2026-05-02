import { KeyRound } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function LicensesPage() {
  return (
    <EmptySection
      title="Licenses"
      description="Digital fulfilment — license keys minted on payment, activations tracked, revocation supported."
      icon={KeyRound}
    />
  );
}
