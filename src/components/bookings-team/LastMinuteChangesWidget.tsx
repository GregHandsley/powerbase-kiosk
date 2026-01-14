import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface RecentActivity {
  id: number;
  title: string;
  created_at: string;
  last_edited_at: string | null;
  last_minute_change: boolean;
  cutoff_at: string | null;
  created_by: string;
  creator_name: string | null;
  side_name: string;
  side_key: string;
  activity_type: 'created' | 'edited';
  activity_date: string;
}

type BookingQueryResult = {
  id: number;
  title: string;
  created_at: string;
  last_edited_at: string | null;
  last_minute_change: boolean;
  cutoff_at: string | null;
  created_by: string;
  side: { name: string; key: string } | { name: string; key: string }[] | null;
};

export function LastMinuteChangesWidget() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('recent-activity-collapsed');
    return saved === 'true';
  });

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('recent-activity-collapsed', String(newState));
  };

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['recent-booking-activity'],
    queryFn: async () => {
      // Get all bookings (created or edited) from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch bookings created in last 7 days
      const { data: createdBookings, error: createdError } = await supabase
        .from('bookings')
        .select(
          `
          id,
          title,
          created_at,
          last_edited_at,
          last_minute_change,
          cutoff_at,
          created_by,
          side:sides (
            name,
            key
          )
        `
        )
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (createdError) {
        console.error('Error fetching created bookings:', createdError);
      }

      // Fetch bookings edited in last 7 days (but not created in last 7 days)
      const { data: editedBookings, error: editedError } = await supabase
        .from('bookings')
        .select(
          `
          id,
          title,
          created_at,
          last_edited_at,
          last_minute_change,
          cutoff_at,
          created_by,
          side:sides (
            name,
            key
          )
        `
        )
        .not('last_edited_at', 'is', null)
        .gte('last_edited_at', sevenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString()) // Exclude ones created in last 7 days
        .order('last_edited_at', { ascending: false })
        .limit(20);

      if (editedError) {
        console.error('Error fetching edited bookings:', editedError);
      }

      // Collect all creator IDs
      const creatorIds = new Set<string>();
      (createdBookings ?? []).forEach((booking: BookingQueryResult) => {
        if (booking.created_by) creatorIds.add(booking.created_by);
      });
      (editedBookings ?? []).forEach((booking: BookingQueryResult) => {
        if (booking.created_by) creatorIds.add(booking.created_by);
      });

      // Fetch all profiles at once
      const allProfileIds = Array.from(creatorIds);
      const profilesMap = new Map<
        string,
        { id: string; full_name: string | null }
      >();

      if (allProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', allProfileIds);

        if (profiles) {
          profiles.forEach((p) => {
            profilesMap.set(p.id, { id: p.id, full_name: p.full_name });
          });
        }
      }

      // Combine and format
      const allActivities: RecentActivity[] = [];

      // Add created bookings
      (createdBookings ?? []).forEach((booking: BookingQueryResult) => {
        const creator = booking.created_by
          ? profilesMap.get(booking.created_by)
          : null;
        const sideName = Array.isArray(booking.side)
          ? booking.side[0]?.name
          : booking.side?.name;
        const sideKey = Array.isArray(booking.side)
          ? booking.side[0]?.key
          : booking.side?.key;

        allActivities.push({
          id: booking.id,
          title: booking.title,
          created_at: booking.created_at,
          last_edited_at: booking.last_edited_at,
          last_minute_change: booking.last_minute_change,
          cutoff_at: booking.cutoff_at,
          created_by: booking.created_by,
          creator_name: creator?.full_name || null,
          side_name: sideName || 'Unknown',
          side_key: sideKey || 'unknown',
          activity_type: 'created',
          activity_date: booking.created_at,
        });
      });

      // Add edited bookings
      (editedBookings ?? []).forEach((booking: BookingQueryResult) => {
        const creator = booking.created_by
          ? profilesMap.get(booking.created_by)
          : null;
        const sideName = Array.isArray(booking.side)
          ? booking.side[0]?.name
          : booking.side?.name;
        const sideKey = Array.isArray(booking.side)
          ? booking.side[0]?.key
          : booking.side?.key;

        allActivities.push({
          id: booking.id,
          title: booking.title,
          created_at: booking.created_at,
          last_edited_at: booking.last_edited_at,
          last_minute_change: booking.last_minute_change,
          cutoff_at: booking.cutoff_at,
          created_by: booking.created_by,
          creator_name: creator?.full_name || null,
          side_name: sideName || 'Unknown',
          side_key: sideKey || 'unknown',
          activity_type: 'edited',
          activity_date: booking.last_edited_at || booking.created_at,
        });
      });

      // Sort by activity date (most recent first) and limit to 3 for widget
      return allActivities
        .sort(
          (a, b) =>
            new Date(b.activity_date).getTime() -
            new Date(a.activity_date).getTime()
        )
        .slice(0, 3);
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Recent Activity
          </h3>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="text-slate-400 hover:text-slate-300 transition-colors"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
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
        {!isCollapsed && (
          <div className="text-xs text-slate-400 mt-2">Loading...</div>
        )}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Recent Activity
          </h3>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="text-slate-400 hover:text-slate-300 transition-colors"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
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
        {!isCollapsed && (
          <div className="text-xs text-slate-400 mt-2">
            No booking activity in the last 7 days
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Recent Activity
        </h3>
        <div className="flex items-center gap-2">
          <Link
            to="/bookings-team"
            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            View all
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="text-slate-400 hover:text-slate-300 transition-colors"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
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
      {!isCollapsed && (
        <div className="space-y-1.5 mt-2">
          {activities.map((activity) => (
            <Link
              key={`${activity.id}-${activity.activity_type}-${activity.activity_date}`}
              to={`/bookings-team?booking=${activity.id}`}
              className="block p-1.5 rounded hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                      {activity.title}
                    </p>
                    {activity.last_minute_change && (
                      <span className="shrink-0 px-1 py-0.5 text-[9px] font-medium rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        Last-Minute
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-slate-500 capitalize">
                      {activity.activity_type}
                    </span>
                    <span className="text-[10px] text-slate-600">•</span>
                    <span className="text-[10px] text-slate-500">
                      {activity.side_name}
                    </span>
                    {activity.creator_name && (
                      <>
                        <span className="text-[10px] text-slate-600">•</span>
                        <span className="text-[10px] text-slate-500 truncate">
                          {activity.creator_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-slate-600">
                    {formatDistanceToNow(new Date(activity.activity_date), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
