import { ClipboardList } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function ReservationsPage() {
  return (
    <EmptySection
      title="Stock reservations"
      description="Soft-holds placed at checkout and released on payment success or expiry. Prevents oversell."
      icon={ClipboardList}
    />
  );
}
