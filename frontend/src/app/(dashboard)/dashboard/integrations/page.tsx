import { Plug } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function IntegrationsPage() {
  return (
    <EmptySection
      title="Integrations"
      description="Couriers (Biteship), inbound webhooks from Plugipay, outbound webhooks to your storefront."
      icon={Plug}
    />
  );
}
