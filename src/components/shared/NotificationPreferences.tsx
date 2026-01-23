import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useNotificationPreferences,
  type NotificationType,
} from '../../hooks/useNotificationPreferences';

function formatNotificationType(type: NotificationType): string {
  const typeMap: Record<NotificationType, string> = {
    'booking:created': 'Booking Created',
    'booking:processed': 'Booking Processed',
    'booking:edited': 'Booking Edited',
    'booking:cancelled': 'Booking Cancelled',
    last_minute_change: 'Last Minute Changes',
    'system:update': 'System Updates',
    'feedback:response': 'Feedback Responses',
  };
  return typeMap[type] || type;
}

/**
 * User Notification Preferences Component
 *
 * For INDIVIDUAL USERS to control their personal notification preferences:
 * - Which notification types they want to receive
 * - In-app vs email delivery preferences
 * - Master enable/disable per notification type
 *
 * This is NOT for system-wide admin settings (see NotificationSettings component in Admin panel).
 */
function getNotificationDescription(type: NotificationType): string {
  const descMap: Record<NotificationType, string> = {
    'booking:created': 'When a new booking is created',
    'booking:processed': 'When your booking is processed by the bookings team',
    'booking:edited': 'When a booking you created is edited',
    'booking:cancelled': 'When a booking is cancelled',
    last_minute_change: 'When last-minute booking changes occur',
    'system:update': 'Important system announcements and updates',
    'feedback:response': 'When you receive a response to your feedback',
  };
  return descMap[type] || '';
}

export function NotificationPreferences() {
  const {
    preferences,
    isLoading,
    getPreference,
    updatePreference,
    resetToDefaults,
    isUpdating,
    isResetting,
    defaultPreferences,
  } = useNotificationPreferences();
  const [isResettingConfirm, setIsResettingConfirm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const notificationTypes: NotificationType[] = [
    'booking:created',
    'booking:processed',
    'booking:edited',
    'booking:cancelled',
    'last_minute_change',
    'system:update',
    'feedback:response',
  ];

  const handleToggle = async (
    type: NotificationType,
    field: 'in_app' | 'email' | 'enabled'
  ) => {
    const current = getPreference(type);
    const newValue = !current[field];

    try {
      await updatePreference({
        type,
        updates: { [field]: newValue },
      });
      toast.success('Preference updated');
    } catch (error) {
      console.error('Error updating preference:', error);
      toast.error('Failed to update preference');
    }
  };

  const handleResetToDefaults = async () => {
    try {
      await resetToDefaults();
      toast.success('Preferences reset to defaults');
      setIsResettingConfirm(false);
    } catch (error) {
      console.error('Error resetting preferences:', error);
      toast.error('Failed to reset preferences');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div className="text-slate-400 text-sm">Loading preferences...</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg">
      {/* Header - Always visible */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-200">
              My Notification Preferences
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Control which notification types you receive and how (in-app or
              email)
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isExpanded && (
              <>
                {!isResettingConfirm ? (
                  <button
                    type="button"
                    onClick={() => setIsResettingConfirm(true)}
                    disabled={isResetting}
                    className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset to Defaults
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleResetToDefaults}
                      disabled={isResetting}
                      className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isResetting ? 'Resetting...' : 'Confirm Reset'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsResettingConfirm(false)}
                      disabled={isResetting}
                      className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4">
          {notificationTypes.map((type) => {
            const pref = getPreference(type);
            const defaultPref = defaultPreferences[type as NotificationType];
            const isDefault =
              pref.in_app === defaultPref.in_app &&
              pref.email === defaultPref.email &&
              pref.enabled === defaultPref.enabled;

            return (
              <div
                key={type}
                className="bg-slate-900/50 border border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-200">
                      {formatNotificationType(type)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {getNotificationDescription(type)}
                    </p>
                  </div>
                  {isDefault && (
                    <span className="text-xs text-slate-500 px-2 py-1 bg-slate-800/50 rounded border border-slate-700">
                      Default
                    </span>
                  )}
                </div>

                {/* Master Enable/Disable Toggle */}
                <div className="flex items-center justify-between py-2 border-b border-slate-700/50 mb-3">
                  <div>
                    <label className="text-sm text-slate-300">
                      Enable notifications
                    </label>
                    <p className="text-xs text-slate-500">
                      Master switch for this notification type
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(type, 'enabled')}
                    disabled={isUpdating}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                      pref.enabled ? 'bg-indigo-600' : 'bg-slate-600'
                    }`}
                    role="switch"
                    aria-checked={pref.enabled}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        pref.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {pref.enabled && (
                  <div className="space-y-2">
                    {/* In-App Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-slate-300">
                          In-app notifications
                        </label>
                        <p className="text-xs text-slate-500">
                          Show in notification bell
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(type, 'in_app')}
                        disabled={isUpdating}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                          pref.in_app ? 'bg-indigo-600' : 'bg-slate-600'
                        }`}
                        role="switch"
                        aria-checked={pref.in_app}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            pref.in_app ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Email Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-slate-300">
                          Email notifications
                        </label>
                        <p className="text-xs text-slate-500">Send via email</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(type, 'email')}
                        disabled={isUpdating}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                          pref.email ? 'bg-indigo-600' : 'bg-slate-600'
                        }`}
                        role="switch"
                        aria-checked={pref.email}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            pref.email ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Email Digest Settings */}
          <div className="mt-6 p-4 bg-slate-900/30 border border-slate-700/50 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Email Digest Settings
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Receive a daily or weekly summary of all unread notifications
              instead of individual emails. When enabled, you'll receive one
              email per day/week with all your unread notifications.
            </p>

            {/* Get digest preference from any notification type (they're all the same) */}
            {(() => {
              // Digest settings are stored per notification type, but they should all be the same
              // Get from the first preference that has digest settings, or use defaults
              const prefWithDigest = preferences.find(
                (p) => p.email_digest_enabled !== undefined
              );
              const digestEnabled =
                prefWithDigest?.email_digest_enabled || false;
              const digestFrequency =
                (prefWithDigest?.email_digest_frequency as
                  | 'daily'
                  | 'weekly'
                  | 'never') || 'never';

              return (
                <div className="space-y-4">
                  {/* Enable Digest Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-slate-300">
                        Enable email digest
                      </label>
                      <p className="text-xs text-slate-500">
                        Receive summaries instead of individual emails
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        // Update all notification types with the same digest setting
                        const newValue = !digestEnabled;
                        const updates = notificationTypes.map((type) =>
                          updatePreference({
                            type,
                            updates: {
                              email_digest_enabled: newValue,
                              email_digest_frequency: newValue
                                ? digestFrequency === 'never'
                                  ? 'daily'
                                  : digestFrequency
                                : 'never',
                            },
                          })
                        );
                        await Promise.all(updates);
                        toast.success(
                          newValue
                            ? 'Email digest enabled'
                            : 'Email digest disabled'
                        );
                      }}
                      disabled={isUpdating}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                        digestEnabled ? 'bg-indigo-600' : 'bg-slate-600'
                      }`}
                      role="switch"
                      aria-checked={digestEnabled}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          digestEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Digest Frequency (only shown if enabled) */}
                  {digestEnabled && (
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">
                        Digest frequency
                      </label>
                      <div className="flex gap-3">
                        {(['daily', 'weekly'] as const).map((freq) => (
                          <button
                            key={freq}
                            type="button"
                            onClick={async () => {
                              const updates = notificationTypes.map((type) =>
                                updatePreference({
                                  type,
                                  updates: { email_digest_frequency: freq },
                                })
                              );
                              await Promise.all(updates);
                              toast.success(
                                `Email digest set to ${freq === 'daily' ? 'daily' : 'weekly'}`
                              );
                            }}
                            disabled={isUpdating}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              digestFrequency === freq
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {freq === 'daily' ? 'Daily' : 'Weekly'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="mt-4 p-4 bg-slate-900/30 border border-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-400">
              <strong className="text-slate-300">Note:</strong> Email
              notifications require your email preferences to be enabled. You
              can manage email preferences in the Email Preferences section.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
