import { useState } from 'react';
import type { NotificationSettings } from '../../../hooks/useNotificationSettings';

type Props = {
  settings: NotificationSettings;
  onUpdate: (updates: Partial<NotificationSettings>) => void;
  isUpdating: boolean;
};

const DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export function ReminderScheduleSection({
  settings,
  onUpdate,
  // isUpdating,
}: Props) {
  const [localEnabled, setLocalEnabled] = useState(
    settings.reminder_emails_enabled
  );
  const [schedule, setSchedule] = useState(settings.reminder_schedule || []);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    settings.reminder_recipient_roles || []
  );

  const addScheduleItem = () => {
    const newItem = {
      time: '09:00',
      days: [1, 2, 3, 4, 5], // Weekdays
      frequency: 'daily' as const,
    };
    const newSchedule = [...schedule, newItem];
    setSchedule(newSchedule);
    onUpdate({ reminder_schedule: newSchedule });
  };

  const removeScheduleItem = (index: number) => {
    const newSchedule = schedule.filter((_, i) => i !== index);
    setSchedule(newSchedule);
    onUpdate({ reminder_schedule: newSchedule });
  };

  const updateScheduleItem = (
    index: number,
    updates: Partial<(typeof schedule)[0]>
  ) => {
    const newSchedule = [...schedule];
    newSchedule[index] = { ...newSchedule[index], ...updates };
    setSchedule(newSchedule);
    onUpdate({ reminder_schedule: newSchedule });
  };

  const handleRoleToggle = (role: string) => {
    const newRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    setSelectedRoles(newRoles);
    onUpdate({ reminder_recipient_roles: newRoles });
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Regular Reminder Emails
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Schedule regular reminder emails with summaries of pending bookings
            and changes needing attention.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-200">
            Enable Reminder Emails
          </label>
          <button
            type="button"
            onClick={() => {
              setLocalEnabled(!localEnabled);
              onUpdate({ reminder_emails_enabled: !localEnabled });
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
          <div className="space-y-4 pt-2 border-t border-slate-700">
            {/* Schedule Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-200">
                  Reminder Schedule
                </label>
                <button
                  type="button"
                  onClick={addScheduleItem}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  + Add Schedule
                </button>
              </div>

              {schedule.length === 0 ? (
                <div className="text-sm text-slate-400 text-center py-4 border border-slate-700 rounded-md">
                  No reminder schedules configured. Click "+ Add Schedule" to
                  create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {schedule.map((item, index) => (
                    <div
                      key={index}
                      className="border border-slate-700 rounded-md p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-200">
                          Schedule {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeScheduleItem(index)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-300 mb-1">
                            Time
                          </label>
                          <input
                            type="time"
                            value={item.time}
                            onChange={(e) =>
                              updateScheduleItem(index, {
                                time: e.target.value,
                              })
                            }
                            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-300 mb-1">
                            Frequency
                          </label>
                          <select
                            value={item.frequency}
                            onChange={(e) =>
                              updateScheduleItem(index, {
                                frequency: e.target.value as 'daily' | 'weekly',
                                days:
                                  e.target.value === 'daily'
                                    ? [1, 2, 3, 4, 5]
                                    : item.days,
                              })
                            }
                            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </div>
                      </div>

                      {item.frequency === 'weekly' && (
                        <div>
                          <label className="block text-xs text-slate-300 mb-2">
                            Days of Week
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {DAYS.map((day) => (
                              <label
                                key={day.value}
                                className="flex items-center gap-1.5 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={item.days.includes(day.value)}
                                  onChange={(e) => {
                                    const newDays = e.target.checked
                                      ? [...item.days, day.value]
                                      : item.days.filter(
                                          (d) => d !== day.value
                                        );
                                    updateScheduleItem(index, {
                                      days: newDays,
                                    });
                                  }}
                                  className="rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs text-slate-300">
                                  {day.short}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recipient Roles */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Recipient Roles
              </label>
              <div className="space-y-2">
                {[
                  { value: 'admin', label: 'Admins' },
                  { value: 'bookings_team', label: 'Bookings Team' },
                ].map((role) => (
                  <label
                    key={role.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.value)}
                      onChange={() => handleRoleToggle(role.value)}
                      className="rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-300">{role.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
