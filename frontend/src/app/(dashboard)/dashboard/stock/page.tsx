import { Boxes } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function StockPage() {
  return (
    <EmptySection
      title="Stock levels"
      description="Per-variant on-hand vs. reserved across every warehouse. Low-stock alerts and reorder thresholds."
      icon={Boxes}
    />
  );
}
