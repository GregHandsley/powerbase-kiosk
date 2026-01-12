import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';
import type { NotificationSettings } from '../../../hooks/useNotificationSettings';

type Props = {
  settings: NotificationSettings;
  onUpdate: (updates: Partial<NotificationSettings>) => void;
  isUpdating: boolean;
};

const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Admins' },
  { value: 'bookings_team', label: 'Bookings Team' },
  { value: 'coach', label: 'Coaches' },
];

export function LastMinuteRecipientsSection({
  settings,
  onUpdate,
  // isUpdating,
}: Props) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    settings.last_minute_alert_roles || []
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    settings.last_minute_alert_user_ids || []
  );

  // Fetch all users for user selector
  // Note: Email is not in profiles table, it's in auth.users
  // We'll fetch profiles and get emails separately if needed
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }

      // Get emails from auth.users (requires admin access)
      // For now, we'll just use the profile data without emails
      // Emails can be retrieved when actually sending emails
      return (profiles || []).map((profile) => ({
        id: profile.id,
        name: profile.full_name || 'Unknown',
        role: profile.role,
      }));
    },
  });

  const handleRoleToggle = (role: string) => {
    const newRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    setSelectedRoles(newRoles);
    onUpdate({ last_minute_alert_roles: newRoles });
  };

  const handleUserToggle = (userId: string) => {
    const newUserIds = selectedUserIds.includes(userId)
      ? selectedUserIds.filter((id) => id !== userId)
      : [...selectedUserIds, userId];
    setSelectedUserIds(newUserIds);
    onUpdate({ last_minute_alert_user_ids: newUserIds });
  };

  // // Get users that match selected roles
  // const usersMatchingRoles = allUsers.filter((user) =>
  //   selectedRoles.includes(user.role)
  // );

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Last-Minute Alert Recipients
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Who should receive email alerts when bookings or changes are made
            after the notification window?
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Recipient Roles
          </label>
          <div className="space-y-2">
            {AVAILABLE_ROLES.map((role) => (
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

        {/* Specific User Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Additional Recipients (Specific Users)
          </label>
          <div className="max-h-48 overflow-y-auto border border-slate-700 rounded-md p-2 space-y-2">
            {allUsers.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-4">
                Loading users...
              </div>
            ) : (
              allUsers.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(user.id)}
                    onChange={() => handleUserToggle(user.id)}
                    className="rounded border-slate-600 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-slate-300">{user.name}</span>
                    <span className="text-xs text-slate-600 ml-2 capitalize">
                      • {user.role}
                    </span>
                  </div>
                </label>
              ))
            )}
          </div>
          {selectedUserIds.length > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              {selectedUserIds.length} additional user
              {selectedUserIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="pt-4 border-t border-slate-700">
          <p className="text-xs font-medium text-slate-300 mb-2">
            Recipients Summary:
          </p>
          <div className="text-xs text-slate-400 space-y-1">
            {selectedRoles.length > 0 && (
              <div>
                <span className="text-slate-300">Roles:</span>{' '}
                {selectedRoles
                  .map(
                    (r) =>
                      AVAILABLE_ROLES.find((role) => role.value === r)?.label
                  )
                  .join(', ')}
              </div>
            )}
            {selectedUserIds.length > 0 && (
              <div>
                <span className="text-slate-300">Additional Users:</span>{' '}
                {selectedUserIds.length}
              </div>
            )}
            {selectedRoles.length === 0 && selectedUserIds.length === 0 && (
              <div className="text-yellow-400">
                No recipients selected - no emails will be sent
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
