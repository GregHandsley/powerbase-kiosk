import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import {
  useAuditLogs,
  useCanReadAudit,
  type AuditLogRow,
} from '../../../hooks/useAuditLogs';
import { usePrimaryOrganizationId } from '../../../hooks/usePermissions';
import { supabase } from '../../../lib/supabaseClient';
import { getUserNamesByIds } from '../../../utils/emailRecipients';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../config/env';

// Known event types for the dropdown
const EVENT_TYPES = [
  'invitation.created',
  'invitation.accepted',
  'invitation.revoked',
  'invitation.deleted',
  'role.updated',
  'permission.granted',
  'permission.revoked',
  'site_membership.created',
  'site_membership.deleted',
  'settings.updated',
];

// Event types that are currently implemented and logging
const IMPLEMENTED_EVENT_TYPES = new Set([
  'invitation.created',
  'invitation.accepted',
  'invitation.revoked',
  'invitation.deleted',
]);

// Convert event type to plain English
function formatEventType(eventType: string): string {
  const eventMap: Record<string, string> = {
    'invitation.created': 'Invitation Created',
    'invitation.accepted': 'Invitation Accepted',
    'invitation.revoked': 'Invitation Revoked',
    'invitation.deleted': 'Invitation Deleted',
    'role.updated': 'Role Updated',
    'permission.granted': 'Permission Granted',
    'permission.revoked': 'Permission Revoked',
    'site_membership.added': 'Site Membership Added',
    'site_membership.removed': 'Site Membership Removed',
    'site_membership.created': 'Site Membership Created',
    'site_membership.deleted': 'Site Membership Deleted',
    'settings.updated': 'Settings Updated',
  };

  // If we have a mapping, use it; otherwise format the event type nicely
  if (eventMap[eventType]) {
    return eventMap[eventType];
  }

  // Fallback: convert snake_case and dots to spaces, then title case
  return eventType
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Convert entity type to plain English
function formatEntityType(entityType: string): string {
  const entityMap: Record<string, string> = {
    invitation: 'Invitation',
    user_role: 'User Role',
    organization_membership: 'Organization Membership',
    user_permission: 'User Permission',
    site_membership: 'Site Membership',
    organization_settings: 'Organization Settings',
    site_settings: 'Site Settings',
  };

  // If we have a mapping, use it; otherwise format the entity type nicely
  if (entityMap[entityType]) {
    return entityMap[entityType];
  }

  // Fallback: convert snake_case and dots to spaces, then title case
  return entityType
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type Props = {
  setExportHandler?: (handler: (() => void) | null) => void;
};

export function AuditLog({ setExportHandler }: Props) {
  const { organizationId } = usePrimaryOrganizationId();
  const { canRead, isLoading: canReadLoading } =
    useCanReadAudit(organizationId);

  // Filters state
  const [eventType, setEventType] = useState<string>('');
  const [actorUserId, setActorUserId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userSearchResults, setUserSearchResults] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userSearchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userSearchRef.current &&
        !userSearchRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Scroll container ref for infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Build filters object
  const filters = useMemo(
    () => ({
      organizationId: organizationId || 0,
      ...(eventType && { eventType }),
      ...(actorUserId && { actorUserId }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      limit: 50,
    }),
    [organizationId, eventType, actorUserId, dateFrom, dateTo]
  );

  // Fetch audit logs
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useAuditLogs(filters);

  // Infinite scroll handler
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasNextPage || isFetchingNextPage) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Load more when user is within 200px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        fetchNextPage();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten pages into single array
  const allRows = useMemo(() => {
    return data?.pages.flatMap((page) => page.rows) || [];
  }, [data]);

  // User lookup cache (we'll fetch on demand)
  const [userCache, setUserCache] = useState<Map<string, string>>(new Map());

  const getUserDisplayName = async (userId: string | null): Promise<string> => {
    if (!userId) return 'System';
    if (userCache.has(userId)) return userCache.get(userId)!;

    try {
      // Use getUserNamesByIds which uses a database function that bypasses RLS
      const nameMap = await getUserNamesByIds([userId]);
      const fullName = nameMap.get(userId);

      if (fullName && fullName.trim() !== '') {
        const displayName = fullName;
        setUserCache((prev) => new Map(prev).set(userId, displayName));
        return displayName;
      }

      // If no name found, check if user is deleted by querying profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_deleted')
        .eq('id', userId)
        .maybeSingle();

      // If user is explicitly marked as deleted, show "Deleted User"
      if (profile?.is_deleted) {
        const displayName = 'Deleted User';
        setUserCache((prev) => new Map(prev).set(userId, displayName));
        return displayName;
      }

      // Fallback to user ID if no name found
      const displayName = userId.substring(0, 8) + '...';
      setUserCache((prev) => new Map(prev).set(userId, displayName));
      return displayName;
    } catch (error) {
      console.error('Error fetching user display name:', error);
      // Fallback to user ID on error
      const displayName = userId.substring(0, 8) + '...';
      setUserCache((prev) => new Map(prev).set(userId, displayName));
      return displayName;
    }
  };

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  // Fetch users for search
  useEffect(() => {
    if (!organizationId || !userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      try {
        // Get users from organization_memberships and join with profiles
        const { data: memberships, error: membershipsError } = await supabase
          .from('organization_memberships')
          .select('user_id')
          .eq('organization_id', organizationId);

        if (membershipsError) {
          console.error('Error fetching memberships:', membershipsError);
          return;
        }

        if (!memberships || memberships.length === 0) {
          setUserSearchResults([]);
          return;
        }

        const userIds = memberships.map((m) => m.user_id);

        // Fetch profiles for these users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds)
          .ilike('full_name', `%${userSearchQuery}%`)
          .limit(10);

        if (profilesError) {
          console.error('Error searching profiles:', profilesError);
          return;
        }

        const results = (profiles || [])
          .map((p) => ({
            id: p.id,
            name: p.full_name || p.id.substring(0, 8) + '...',
          }))
          .filter((u) =>
            u.name.toLowerCase().includes(userSearchQuery.toLowerCase())
          );

        setUserSearchResults(results);
      } catch (error) {
        console.error('Error in user search:', error);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [organizationId, userSearchQuery]);

  const handleUserSelect = (userId: string, userName: string) => {
    setActorUserId(userId);
    setUserSearchQuery(userName);
    setShowUserDropdown(false);
  };

  const handleUserSearchChange = (value: string) => {
    setUserSearchQuery(value);
    setShowUserDropdown(true);
    if (!value) {
      setActorUserId('');
      setUserSearchResults([]);
    }
  };

  const clearFilters = () => {
    setEventType('');
    setActorUserId('');
    setUserSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setUserSearchResults([]);
  };

  const handleExportCsv = useCallback(async () => {
    if (!organizationId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Build query parameters matching current filters
      const params = new URLSearchParams({
        organizationId: organizationId.toString(),
      });

      if (eventType) {
        params.append('eventType', eventType);
      }
      if (actorUserId) {
        params.append('actorUserId', actorUserId);
      }
      if (dateFrom) {
        params.append('dateFrom', dateFrom);
      }
      if (dateTo) {
        params.append('dateTo', dateTo);
      }

      // Call Edge Function
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/export-audit-logs-csv?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: 'Failed to export audit logs',
        }));
        throw new Error(error.error || 'Failed to export audit logs');
      }

      // Get the CSV content
      const csv = await response.text();

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'audit-logs.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to export audit logs. Please try again.'
      );
    }
  }, [organizationId, eventType, actorUserId, dateFrom, dateTo]);

  useEffect(() => {
    setExportHandler?.(() => handleExportCsv);
    return () => setExportHandler?.(null);
  }, [handleExportCsv, setExportHandler]);

  // Permission check
  if (canReadLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-300 text-sm">Loading...</div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-400 text-lg">
          Not authorized to view audit logs
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0 overflow-hidden">
      {/* Filters */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 flex-shrink-0">
        <div className="flex flex-wrap items-end gap-4">
          {/* Event Type */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Event Type
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm"
            >
              <option value="">All events</option>
              {EVENT_TYPES.map((type) => {
                const isImplemented = IMPLEMENTED_EVENT_TYPES.has(type);
                return (
                  <option key={type} value={type}>
                    {formatEventType(type)}
                    {!isImplemented && ' (Pending)'}
                  </option>
                );
              })}
            </select>
          </div>

          {/* User Search */}
          <div className="relative flex-1 min-w-[200px]" ref={userSearchRef}>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              User
            </label>
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => handleUserSearchChange(e.target.value)}
              onFocus={() => setShowUserDropdown(true)}
              placeholder="Search by name..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm"
            />
            {showUserDropdown && userSearchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg max-h-60 overflow-auto">
                {userSearchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleUserSelect(user.id, user.name)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-700 text-slate-100 text-sm"
                  >
                    {user.name}
                  </button>
                ))}
              </div>
            )}
            {showUserDropdown &&
              userSearchQuery &&
              userSearchResults.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg px-3 py-2 text-slate-400 text-sm">
                  No users found
                </div>
              )}
          </div>

          {/* Date From */}
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm"
            />
          </div>

          {/* Date To */}
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm"
            />
          </div>

          {/* Clear Filters Button */}
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm h-[38px] flex-shrink-0"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-slate-300 text-sm">Loading audit logs...</div>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
          <div className="text-red-400">
            Error loading audit logs:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </div>
      ) : allRows.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-8 text-center">
          <div className="text-slate-400">No audit logs found</div>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
          <div ref={scrollContainerRef} className="overflow-y-auto pb-2 flex-1">
            <table className="w-full">
              <thead className="bg-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">
                    Event
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">
                    Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {allRows.map((row) => (
                  <AuditLogRow
                    key={row.id}
                    row={row}
                    isExpanded={expandedRows.has(row.id)}
                    onToggle={() => toggleRow(row.id)}
                    getUserDisplayName={getUserDisplayName}
                  />
                ))}
              </tbody>
            </table>
            {isFetchingNextPage && (
              <div className="flex justify-center items-center py-6 bg-slate-900/30 border-t border-slate-700/50">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Loading more events...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AuditLogRowProps {
  row: AuditLogRow;
  isExpanded: boolean;
  onToggle: () => void;
  getUserDisplayName: (userId: string | null) => Promise<string>;
}

function AuditLogRow({
  row,
  isExpanded,
  onToggle,
  getUserDisplayName,
}: AuditLogRowProps) {
  const [actorName, setActorName] = useState<string>('');

  // Load user names on mount
  useEffect(() => {
    if (row.actor_user_id) {
      getUserDisplayName(row.actor_user_id)
        .then((name) => {
          setActorName(name || 'Unknown User');
        })
        .catch(() => {
          setActorName('Unknown User');
        });
    } else {
      setActorName('System');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.actor_user_id]);

  const entityDisplay = row.entity_id
    ? `${formatEntityType(row.entity_type)}: ${row.entity_id.substring(0, 8)}...`
    : formatEntityType(row.entity_type);

  const createdAt = parseISO(row.created_at);
  const relativeTime = formatDistanceToNow(createdAt, { addSuffix: true });
  const exactTime = format(createdAt, 'PPpp');

  // Helper to safely format dates
  const formatDate = (dateValue: unknown): string => {
    if (!dateValue) return 'N/A';
    try {
      const date = new Date(dateValue as string);
      if (isNaN(date.getTime())) {
        return String(dateValue);
      }
      return format(date, 'PPpp');
    } catch {
      return String(dateValue);
    }
  };

  // Format friendly details from metadata and values
  const eventDetails = useMemo(() => {
    const details: Array<{ label: string; value: string }> = [];
    const metadata = row.metadata || {};

    // Invitation events
    if (row.event_type.startsWith('invitation.')) {
      if (metadata.email) {
        details.push({
          label: 'Email',
          value: metadata.email as string,
        });
      }
      if (metadata.role) {
        details.push({
          label: 'Role',
          value: String(metadata.role)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase()),
        });
      }
      if (metadata.expires_at) {
        details.push({
          label: 'Expires',
          value: formatDate(metadata.expires_at),
        });
      }
      if (row.event_type === 'invitation.accepted' && metadata.accepted_at) {
        details.push({
          label: 'Accepted At',
          value: formatDate(metadata.accepted_at),
        });
      }
      if (row.event_type === 'invitation.revoked' && metadata.revoked_at) {
        details.push({
          label: 'Revoked At',
          value: formatDate(metadata.revoked_at),
        });
      }
      if (metadata.site_names && Array.isArray(metadata.site_names)) {
        details.push({
          label: 'Sites',
          value: (metadata.site_names as string[]).join(', '),
        });
      }
    }

    // Role update events
    if (row.event_type === 'role.updated') {
      if (row.old_value && row.new_value) {
        const oldRole = (row.old_value as Record<string, unknown>).role;
        const newRole = (row.new_value as Record<string, unknown>).role;
        if (oldRole && newRole) {
          details.push({
            label: 'Role Change',
            value: `${String(oldRole).replace(/_/g, ' ')} → ${String(
              newRole
            ).replace(/_/g, ' ')}`,
          });
        }
      }
      if (metadata.user_email) {
        details.push({
          label: 'User',
          value: metadata.user_email as string,
        });
      }
    }

    // Permission events
    if (row.event_type.startsWith('permission.')) {
      if (metadata.permission_key) {
        details.push({
          label: 'Permission',
          value: String(metadata.permission_key)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase()),
        });
      }
      if (metadata.permission_name) {
        details.push({
          label: 'Permission Name',
          value: metadata.permission_name as string,
        });
      }
      if (metadata.user_email) {
        details.push({
          label: 'User',
          value: metadata.user_email as string,
        });
      }
    }

    // Site membership events
    if (row.event_type.startsWith('site_membership.')) {
      if (metadata.site_name) {
        details.push({
          label: 'Site',
          value: metadata.site_name as string,
        });
      }
      if (metadata.user_email) {
        details.push({
          label: 'User',
          value: metadata.user_email as string,
        });
      }
    }

    // Settings update events
    if (row.event_type === 'settings.updated') {
      if (metadata.setting_type) {
        details.push({
          label: 'Setting Type',
          value: String(metadata.setting_type)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase()),
        });
      }
      if (metadata.organization_name) {
        details.push({
          label: 'Organization',
          value: metadata.organization_name as string,
        });
      }
      if (metadata.site_name) {
        details.push({
          label: 'Site',
          value: metadata.site_name as string,
        });
      }
    }

    return details;
  }, [row]);

  // Compute diff for settings changes
  const settingsDiff = useMemo(() => {
    if (
      row.event_type !== 'settings.updated' ||
      !row.old_value ||
      !row.new_value
    ) {
      return null;
    }

    const old = row.old_value as Record<string, unknown>;
    const new_ = row.new_value as Record<string, unknown>;
    const diff: Array<{ field: string; old: string; new_: string }> = [];

    // Find changed keys and format them nicely
    const allKeys = new Set([...Object.keys(old), ...Object.keys(new_)]);
    for (const key of allKeys) {
      if (JSON.stringify(old[key]) !== JSON.stringify(new_[key])) {
        const oldVal = old[key];
        const newVal = new_[key];

        // Format values based on type
        let oldStr = String(oldVal);
        let newStr = String(newVal);

        if (oldVal instanceof Object || newVal instanceof Object) {
          oldStr = JSON.stringify(oldVal, null, 2);
          newStr = JSON.stringify(newVal, null, 2);
        } else if (typeof oldVal === 'boolean' || typeof newVal === 'boolean') {
          oldStr = oldVal ? 'Yes' : 'No';
          newStr = newVal ? 'Yes' : 'No';
        }

        diff.push({
          field: key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase()),
          old: oldStr,
          new_: newStr,
        });
      }
    }

    return diff.length > 0 ? diff : null;
  }, [row]);

  // Compute diff for role changes
  const roleDiff = useMemo(() => {
    if (row.event_type !== 'role.updated' || !row.old_value || !row.new_value) {
      return null;
    }

    const old = row.old_value as Record<string, unknown>;
    const new_ = row.new_value as Record<string, unknown>;
    const changes: Array<{ field: string; old: string; new_: string }> = [];

    const allKeys = new Set([...Object.keys(old), ...Object.keys(new_)]);
    for (const key of allKeys) {
      if (JSON.stringify(old[key]) !== JSON.stringify(new_[key])) {
        changes.push({
          field: key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase()),
          old: String(old[key] || 'N/A'),
          new_: String(new_[key] || 'N/A'),
        });
      }
    }

    return changes.length > 0 ? changes : null;
  }, [row]);

  return (
    <>
      <tr className="hover:bg-slate-800/30 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 text-sm text-slate-300">
          <div className="flex flex-col">
            <span>{relativeTime}</span>
            <span className="text-xs text-slate-500" title={exactTime}>
              {exactTime}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-300">
          {formatEventType(row.event_type)}
        </td>
        <td className="px-4 py-3 text-sm text-slate-300">
          {actorName || 'Loading...'}
        </td>
        <td className="px-4 py-3 text-sm text-slate-300 text-xs">
          {entityDisplay}
        </td>
        <td className="px-4 py-3 text-sm text-slate-300">
          <button className="text-indigo-400 hover:text-indigo-300">
            {isExpanded ? '▼' : '▶'}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="px-4 py-4 bg-slate-800/50">
            <div className="space-y-4">
              {/* Event Details - Friendly Format */}
              {eventDetails.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-200 mb-3">
                    Event Information
                  </h4>
                  <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-4 space-y-3">
                    {eventDetails.map((detail, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <span className="text-slate-400 text-sm font-medium min-w-[120px]">
                          {detail.label}:
                        </span>
                        <span className="text-slate-200 text-sm flex-1">
                          {detail.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settings Changes - Friendly Format */}
              {settingsDiff && settingsDiff.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-200 mb-3">
                    Settings Changes
                  </h4>
                  <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-4 space-y-3">
                    {settingsDiff.map((change, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="text-slate-300 text-sm font-medium">
                          {change.field}
                        </div>
                        <div className="ml-4 space-y-1">
                          <div className="text-red-400 text-sm flex items-center gap-2">
                            <span className="text-xs">−</span>
                            <span className="whitespace-pre-wrap break-words">
                              {change.old}
                            </span>
                          </div>
                          <div className="text-green-400 text-sm flex items-center gap-2">
                            <span className="text-xs">+</span>
                            <span className="whitespace-pre-wrap break-words">
                              {change.new_}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Role Changes - Friendly Format */}
              {roleDiff && roleDiff.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-200 mb-3">
                    Role Changes
                  </h4>
                  <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-4 space-y-3">
                    {roleDiff.map((change, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="text-slate-300 text-sm font-medium">
                          {change.field}
                        </div>
                        <div className="ml-4 space-y-1">
                          <div className="text-red-400 text-sm flex items-center gap-2">
                            <span className="text-xs">−</span>
                            <span>{change.old}</span>
                          </div>
                          <div className="text-green-400 text-sm flex items-center gap-2">
                            <span className="text-xs">+</span>
                            <span>{change.new_}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Details - Collapsible */}
              {(row.old_value ||
                row.new_value ||
                (row.metadata &&
                  Object.keys(row.metadata).length > eventDetails.length)) && (
                <details className="group">
                  <summary className="text-sm font-medium text-slate-400 hover:text-slate-300 cursor-pointer list-none">
                    <span className="flex items-center gap-2">
                      <span>Technical Details</span>
                      <span className="text-xs">▼</span>
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    {row.old_value && (
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 mb-1">
                          Old Value:
                        </h5>
                        <pre className="bg-slate-900/50 rounded p-2 text-xs text-slate-400 overflow-x-auto">
                          {JSON.stringify(row.old_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    {row.new_value && (
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 mb-1">
                          New Value:
                        </h5>
                        <pre className="bg-slate-900/50 rounded p-2 text-xs text-slate-400 overflow-x-auto">
                          {JSON.stringify(row.new_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    {row.metadata &&
                      Object.keys(row.metadata).length >
                        eventDetails.length && (
                        <div>
                          <h5 className="text-xs font-medium text-slate-400 mb-1">
                            Full Metadata:
                          </h5>
                          <pre className="bg-slate-900/50 rounded p-2 text-xs text-slate-400 overflow-x-auto">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                  </div>
                </details>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
