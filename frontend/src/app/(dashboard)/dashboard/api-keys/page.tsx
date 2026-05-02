import { KeyRound } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function ApiKeysPage() {
  return (
    <EmptySection
      title="API Keys"
      description="HMAC keys to call the Fulkruma API server-to-server. Scoped per workspace, rotatable, audit-logged."
      icon={KeyRound}
    />
  );
}
