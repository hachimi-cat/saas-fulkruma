import { Settings as SettingsIcon } from 'lucide-react';
import { EmptySection } from '@/components/dashboard/empty-section';

export default function SettingsPage() {
  return (
    <EmptySection
      title="Settings"
      description="Workspace name, billing module, API keys, and team management (via Huudis)."
      icon={SettingsIcon}
    />
  );
}
