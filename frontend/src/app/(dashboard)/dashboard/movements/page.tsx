import { ArrowLeftRight } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function MovementsPage() {
  return (
    <EmptySection
      title="Stock movements"
      description="Append-only ledger of every receipt, transfer, adjustment, and shipment-out. Source of truth for on-hand."
      icon={ArrowLeftRight}
    />
  );
}
