import { Warehouse } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function WarehousesPage() {
  return (
    <EmptySection
      title="Warehouses"
      description="Each physical or virtual location that holds stock. Per-warehouse capacity, address, and Biteship origin."
      icon={Warehouse}
    />
  );
}
