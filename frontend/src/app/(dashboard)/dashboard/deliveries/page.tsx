import { PackageCheck } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function DeliveriesPage() {
  return (
    <EmptySection
      title="Deliveries"
      description="Per-order delivery state: ready-to-ship, in-transit, delivered. Aggregates physical + digital fulfilment."
      icon={PackageCheck}
    />
  );
}
