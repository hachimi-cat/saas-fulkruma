import { Truck } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function ShipmentsPage() {
  return (
    <EmptySection
      title="Shipments"
      description="Outbound parcels, courier, tracking number, and event timeline. Backed by Biteship for Indonesian couriers."
      icon={Truck}
    />
  );
}
