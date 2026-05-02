import { Send } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function ShippingPage() {
  return (
    <EmptySection
      title="Shipping"
      description="Courier rate cards, pickup schedules, and Biteship account configuration. Pick which couriers your storefront offers at checkout."
      icon={Send}
    />
  );
}
