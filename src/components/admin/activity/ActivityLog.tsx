import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import {
  useActivityLogs,
  type ActivityLogRow,
} from '../../../hooks/useActivityLogs';
import { usePrimaryOrganizationId } from '../../../hooks/usePermissions';
import { supabase } from '../../../lib/supabaseClient';
import { getUserNamesByIds } from '../../../utils/emailRecipients';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../config/env';

// Known event types for the dropdown
const EVENT_TYPES = [
  'booking.created',
  'booking.updated',
  'booking.approved',
  'booking.rejected',
  'booking.cancellation_requested',
  'booking.cancellation_confirmed',
  'booking.cancelled',
  'booking.deleted',
];

// Convert event type to plain English
function formatEventType(eventType: string): string {
  const eventMap: Record<string, string> = {
    'booking.created': 'Booking Created',
    'booking.updated': 'Booking Updated',
    'booking.approved': 'Booking Approved',
    'booking.rejected': 'Booking Rejected',
    'booking.cancellation_requested': 'Cancellation Requested',
    'booking.cancellation_confirmed': 'Cancellation Confirmed',
    'booking.cancelled': 'Booking Cancelled',
    'booking.deleted': 'Booking Deleted',
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
    booking: 'Booking',
    task: 'Task',
    notification: 'Notification',
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

export function ActivityLog({ setExportHandler }: Props) {
  const { organizationId } = usePrimaryOrganizationId();

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

  // Fetch activity logs
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useActivityLogs(filters);

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
        `${SUPABASE_URL}/functions/v1/export-activity-logs-csv?${params.toString()}`,
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
          error: 'Failed to export activity logs',
        }));
        throw new Error(error.error || 'Failed to export activity logs');
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
      let filename = 'activity-logs.csv';
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
          : 'Failed to export activity logs. Please try again.'
      );
    }
  }, [organizationId, eventType, actorUserId, dateFrom, dateTo]);

  useEffect(() => {
    setExportHandler?.(() => handleExportCsv);
    return () => setExportHandler?.(null);
  }, [handleExportCsv, setExportHandler]);

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
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatEventType(type)}
                </option>
              ))}
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
          <div className="text-slate-300 text-sm">Loading activity logs...</div>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
          <div className="text-red-400">
            Error loading activity logs:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </div>
      ) : allRows.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-8 text-center">
          <div className="text-slate-400">No activity logs found</div>
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
                  <ActivityLogRow
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

interface ActivityLogRowProps {
  row: ActivityLogRow;
  isExpanded: boolean;
  onToggle: () => void;
  getUserDisplayName: (userId: string | null) => Promise<string>;
}

function ActivityLogRow({
  row,
  isExpanded,
  onToggle,
  getUserDisplayName,
}: ActivityLogRowProps) {
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

  // Format friendly booking details from metadata
  const bookingDetails = useMemo(() => {
    const details: Array<{ label: string; value: string }> = [];
    const metadata = row.metadata || {};

    // Booking title (most events have this)
    if (metadata.title) {
      details.push({
        label: 'Booking',
        value: metadata.title as string,
      });
    }

    // Booking ID
    if (metadata.booking_id) {
      details.push({
        label: 'Booking ID',
        value: `#${metadata.booking_id}`,
      });
    }

    // Event-specific details
    if (row.event_type === 'booking.created') {
      if (metadata.last_minute_change) {
        details.push({
          label: 'Note',
          value: 'Created after notification deadline',
        });
      }
    }

    if (row.event_type === 'booking.cancellation_requested') {
      const cancelMode = metadata.cancel_mode as string;
      const instancesCancelled = metadata.instances_cancelled as number;
      const totalInstances = metadata.total_instances as number;

      if (cancelMode === 'single') {
        details.push({
          label: 'Cancellation Type',
          value: 'Single instance',
        });
      } else if (cancelMode === 'future') {
        details.push({
          label: 'Cancellation Type',
          value: `Future instances (${instancesCancelled} of ${totalInstances} instances)`,
        });
      } else if (cancelMode === 'all') {
        details.push({
          label: 'Cancellation Type',
          value: 'All instances',
        });
      }
      details.push({
        label: 'Status',
        value: 'Pending confirmation',
      });
    }

    if (row.event_type === 'booking.cancellation_confirmed') {
      details.push({
        label: 'Status',
        value: 'Confirmed by bookings team',
      });
    }

    if (row.event_type === 'booking.updated') {
      if (metadata.action === 'extended') {
        const weeksAdded = metadata.weeks_added as number;
        details.push({
          label: 'Action',
          value: `Extended by ${weeksAdded} week${weeksAdded > 1 ? 's' : ''}`,
        });
      } else if (metadata.action === 'instances_deleted') {
        const instancesDeleted = metadata.instances_deleted as number;
        details.push({
          label: 'Action',
          value: `${instancesDeleted} instance${instancesDeleted > 1 ? 's' : ''} deleted`,
        });
      }
    }

    if (row.event_type === 'booking.approved') {
      if (metadata.bulk_operation) {
        details.push({
          label: 'Note',
          value: 'Processed as part of bulk operation',
        });
      }
    }

    return details;
  }, [row]);

  // Format time changes in a friendly way
  const timeChanges = useMemo(() => {
    if (
      row.event_type !== 'booking.updated' ||
      !row.old_value ||
      !row.new_value
    ) {
      return null;
    }

    const oldVal = row.old_value as Record<string, unknown>;
    const newVal = row.new_value as Record<string, unknown>;
    const changes: Array<{ field: string; old: string; new: string }> = [];

    // Helper to safely format dates
    const formatDate = (dateValue: unknown): string => {
      if (!dateValue) return 'N/A';
      try {
        const date = new Date(dateValue as string);
        if (isNaN(date.getTime())) {
          return String(dateValue);
        }
        return date.toLocaleString();
      } catch {
        return String(dateValue);
      }
    };

    if (oldVal.start && newVal.start && oldVal.start !== newVal.start) {
      const oldTime = formatDate(oldVal.start);
      const newTime = formatDate(newVal.start);
      changes.push({ field: 'Start Time', old: oldTime, new: newTime });
    }

    if (oldVal.end && newVal.end && oldVal.end !== newVal.end) {
      const oldTime = formatDate(oldVal.end);
      const newTime = formatDate(newVal.end);
      changes.push({ field: 'End Time', old: oldTime, new: newTime });
    }

    if (
      oldVal.capacity !== undefined &&
      newVal.capacity !== undefined &&
      oldVal.capacity !== newVal.capacity
    ) {
      changes.push({
        field: 'Capacity',
        old: `${oldVal.capacity} athlete${oldVal.capacity !== 1 ? 's' : ''}`,
        new: `${newVal.capacity} athlete${newVal.capacity !== 1 ? 's' : ''}`,
      });
    }

    return changes.length > 0 ? changes : null;
  }, [row]);

  // Compute diff for booking changes
  const bookingDiff = useMemo(() => {
    if (
      row.event_type !== 'booking.updated' ||
      !row.old_value ||
      !row.new_value
    ) {
      return null;
    }

    const old = row.old_value as Record<string, unknown>;
    const new_ = row.new_value as Record<string, unknown>;
    const diff: Record<string, { old: unknown; new_: unknown }> = {};

    // Find changed keys
    const allKeys = new Set([...Object.keys(old), ...Object.keys(new_)]);
    for (const key of allKeys) {
      if (JSON.stringify(old[key]) !== JSON.stringify(new_[key])) {
        diff[key] = { old: old[key], new_: new_[key] };
      }
    }

    return diff;
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
              {/* Booking Details - Friendly Format */}
              {bookingDetails.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-200 mb-3">
                    Booking Information
                  </h4>
                  <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-4 space-y-3">
                    {bookingDetails.map((detail, idx) => (
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

              {/* Time Changes - Friendly Format */}
              {timeChanges && timeChanges.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-200 mb-3">
                    Changes Made
                  </h4>
                  <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-4 space-y-3">
                    {timeChanges.map((change, idx) => (
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
                            <span>{change.new}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Booking Diff - Fallback for other changes */}
              {bookingDiff &&
                Object.keys(bookingDiff).length > 0 &&
                !timeChanges && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-200 mb-3">
                      Changes Made
                    </h4>
                    <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-4 space-y-3">
                      {Object.entries(bookingDiff).map(
                        ([key, { old, new_ }]) => (
                          <div key={key} className="space-y-1">
                            <div className="text-slate-300 text-sm font-medium capitalize">
                              {key.replace(/_/g, ' ')}
                            </div>
                            <div className="ml-4 space-y-1">
                              <div className="text-red-400 text-sm flex items-center gap-2">
                                <span className="text-xs">−</span>
                                <span>{String(old)}</span>
                              </div>
                              <div className="text-green-400 text-sm flex items-center gap-2">
                                <span className="text-xs">+</span>
                                <span>{String(new_)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* Technical Details - Collapsible */}
              {(row.old_value ||
                row.new_value ||
                (row.metadata &&
                  Object.keys(row.metadata).length >
                    bookingDetails.length)) && (
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
                        bookingDetails.length && (
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
