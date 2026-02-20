import { useState } from 'react';
import type { NotificationSettings } from '../../../hooks/useNotificationSettings';

type Props = {
  settings: NotificationSettings;
  onUpdate: (updates: Partial<NotificationSettings>) => void;
  isUpdating: boolean;
};

export function HardRestrictionSection({
  settings,
  onUpdate,
  // isUpdating,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(
    settings.hard_restriction_enabled
  );
  const [localHours, setLocalHours] = useState(settings.hard_restriction_hours);

  const handleSave = () => {
    onUpdate({
      hard_restriction_enabled: localEnabled,
      hard_restriction_hours: localHours,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-expanded={!isCollapsed}
        className="mb-4 flex w-full items-start justify-between rounded-md border border-slate-700/70 bg-slate-800/40 px-3 py-2 text-left transition-colors hover:bg-slate-800/70"
      >
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Hard Restriction
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Prevents bookings from being created or edited within a specified
            number of hours before the session starts. This is a hard block -
            bookings will be rejected.
          </p>
        </div>
        <svg
          className={`ml-4 mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {!isCollapsed && (
        <div className="space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-200">
              Enable Hard Restriction
            </label>
            <button
              type="button"
              onClick={() => {
                setLocalEnabled(!localEnabled);
                onUpdate({ hard_restriction_enabled: !localEnabled });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localEnabled ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {localEnabled && (
            <div className="pt-2 border-t border-slate-700">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Hours Before Session
              </label>
              <input
                type="number"
                min="1"
                max="48"
                value={localHours}
                onChange={(e) => setLocalHours(Number(e.target.value))}
                onBlur={handleSave}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Bookings cannot be created or edited within {localHours} hours
                of the session start time.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
