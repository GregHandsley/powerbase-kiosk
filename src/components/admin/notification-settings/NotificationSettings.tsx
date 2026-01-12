import { useState } from 'react';
import { useNotificationSettings } from '../../../hooks/useNotificationSettings';
import { NotificationWindowSection } from './NotificationWindowSection';
import { HardRestrictionSection } from './HardRestrictionSection';
import { LastMinuteRecipientsSection } from './LastMinuteRecipientsSection';
import { ReminderScheduleSection } from './ReminderScheduleSection';
import { EmailServiceConfigSection } from './EmailServiceConfigSection';
import toast from 'react-hot-toast';

export function NotificationSettings() {
  const { settings, isLoading, updateSettings, isUpdating } =
    useNotificationSettings();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Loading notification settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-400">Error loading notification settings</div>
      </div>
    );
  }

  const handleSave = async (sectionUpdates: Partial<typeof settings>) => {
    try {
      await updateSettings(sectionUpdates);
      setHasUnsavedChanges(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save settings'
      );
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Notification & Email Settings
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure notification windows, email recipients, and reminder
            schedules
          </p>
        </div>
        {hasUnsavedChanges && (
          <div className="text-xs text-yellow-400 bg-yellow-900/20 px-3 py-1.5 rounded border border-yellow-700">
            Unsaved changes
          </div>
        )}
      </div>

      {/* Settings Sections */}
      <div className="space-y-6 pb-6">
        <NotificationWindowSection
          settings={settings}
          onUpdate={(updates) => {
            setHasUnsavedChanges(true);
            handleSave(updates);
          }}
          isUpdating={isUpdating}
        />

        <HardRestrictionSection
          settings={settings}
          onUpdate={(updates) => {
            setHasUnsavedChanges(true);
            handleSave(updates);
          }}
          isUpdating={isUpdating}
        />

        <LastMinuteRecipientsSection
          settings={settings}
          onUpdate={(updates) => {
            setHasUnsavedChanges(true);
            handleSave(updates);
          }}
          isUpdating={isUpdating}
        />

        <ReminderScheduleSection
          settings={settings}
          onUpdate={(updates) => {
            setHasUnsavedChanges(true);
            handleSave(updates);
          }}
          isUpdating={isUpdating}
        />

        <EmailServiceConfigSection />
      </div>
    </div>
  );
}
