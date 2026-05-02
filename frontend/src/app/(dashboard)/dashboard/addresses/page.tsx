import { MapPin } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function AddressesPage() {
  return (
    <EmptySection
      title="Customer addresses"
      description="Buyer address book per merchant. Saved at checkout, reused on subsequent orders."
      icon={MapPin}
    />
  );
}
