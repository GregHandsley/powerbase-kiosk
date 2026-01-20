import { useState, useMemo, useEffect, useRef } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import {
  useAuditLogs,
  useCanReadAudit,
  type AuditLogRow,
} from '../../../hooks/useAuditLogs';
import { usePrimaryOrganizationId } from '../../../hooks/usePermissions';
import { supabase } from '../../../lib/supabaseClient';

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

export function AuditLog() {
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

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, id, is_deleted')
      .eq('id', userId)
      .maybeSingle();

    // If profile not found or user is deleted, show "Deleted User"
    if (!profile || profile.is_deleted) {
      const displayName = 'Deleted User';
      setUserCache((prev) => new Map(prev).set(userId, displayName));
      return displayName;
    }

    const displayName = profile.full_name || userId.substring(0, 8) + '...';
    setUserCache((prev) => new Map(prev).set(userId, displayName));
    return displayName;
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
      {/* Header */}
      <div className="flex-shrink-0">
        <h2 className="text-2xl font-semibold text-slate-100">Audit Log</h2>
        <p className="text-slate-400 text-sm mt-1">
          Privileged actions and governance changes
        </p>
      </div>

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
              {/* Settings Diff */}
              {settingsDiff && Object.keys(settingsDiff).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-200 mb-2">
                    Changed Settings:
                  </h4>
                  <div className="bg-slate-900/50 rounded p-3 space-y-2">
                    {Object.entries(settingsDiff).map(
                      ([key, { old, new_ }]) => (
                        <div key={key} className="text-sm">
                          <span className="font-mono text-slate-300">
                            {key}:
                          </span>
                          <div className="ml-4 mt-1">
                            <div className="text-red-400">
                              - {JSON.stringify(old, null, 2)}
                            </div>
                            <div className="text-green-400">
                              + {JSON.stringify(new_, null, 2)}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Old Value */}
              {row.old_value && (
                <div>
                  <h4 className="text-sm font-medium text-slate-200 mb-2">
                    Old Value:
                  </h4>
                  <pre className="bg-slate-900/50 rounded p-3 text-xs text-slate-300 overflow-x-auto">
                    {JSON.stringify(row.old_value, null, 2)}
                  </pre>
                </div>
              )}

              {/* New Value */}
              {row.new_value && (
                <div>
                  <h4 className="text-sm font-medium text-slate-200 mb-2">
                    New Value:
                  </h4>
                  <pre className="bg-slate-900/50 rounded p-3 text-xs text-slate-300 overflow-x-auto">
                    {JSON.stringify(row.new_value, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {row.metadata && Object.keys(row.metadata).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-200 mb-2">
                    Metadata:
                  </h4>
                  <pre className="bg-slate-900/50 rounded p-3 text-xs text-slate-300 overflow-x-auto">
                    {JSON.stringify(row.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
