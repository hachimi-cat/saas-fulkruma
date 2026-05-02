import { Webhook } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function WebhooksPage() {
  return (
    <EmptySection
      title="Webhooks"
      description="Outbound webhook endpoints for Fulkruma events (shipment.*, license.*, stock.adjusted, delivery.*). HMAC-signed, retried with exponential backoff."
      icon={Webhook}
    />
  );
}
