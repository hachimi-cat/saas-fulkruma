import { ScrollText } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function AuditLogPage() {
  return (
    <EmptySection
      title="Audit Log"
      description="Every state-changing action across warehouses, stock, shipments, licenses, deliveries — actor, IP, timestamp, before/after."
      icon={ScrollText}
    />
  );
}
