import { useState } from "react";
import type { NotificationSettings } from "../../../hooks/useNotificationSettings";

type Props = {
  settings: NotificationSettings;
  onUpdate: (updates: Partial<NotificationSettings>) => void;
  isUpdating: boolean;
};

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function NotificationWindowSection({ settings, onUpdate, isUpdating }: Props) {
  const [localEnabled, setLocalEnabled] = useState(settings.notification_window_enabled);
  const [localDay, setLocalDay] = useState(settings.notification_window_day_of_week);
  const [localTime, setLocalTime] = useState(settings.notification_window_time.slice(0, 5)); // HH:mm

  const handleSave = () => {
    onUpdate({
      notification_window_enabled: localEnabled,
      notification_window_day_of_week: localDay,
      notification_window_time: `${localTime}:00`,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Notification Window</h3>
          <p className="text-sm text-slate-400 mt-1">
            When bookings or changes are made after this time, email alerts will be sent to configured recipients.
            This is not a hard cutoff - bookings are still allowed.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-200">Enable Notification Window</label>
          <button
            type="button"
            onClick={() => {
              setLocalEnabled(!localEnabled);
              onUpdate({ notification_window_enabled: !localEnabled });
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localEnabled ? "bg-indigo-600" : "bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {localEnabled && (
          <div className="space-y-4 pt-2 border-t border-slate-700">
            {/* Day of Week */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Day of Week
              </label>
              <select
                value={localDay}
                onChange={(e) => setLocalDay(Number(e.target.value))}
                onBlur={handleSave}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Time
              </label>
              <input
                type="time"
                value={localTime}
                onChange={(e) => setLocalTime(e.target.value)}
                onBlur={handleSave}
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Current setting: {DAYS_OF_WEEK.find((d) => d.value === localDay)?.label} at {localTime}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

