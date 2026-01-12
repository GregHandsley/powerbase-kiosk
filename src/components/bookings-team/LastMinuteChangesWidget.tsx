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
  creator: { full_name: string | null } | { full_name: string | null }[] | null;
};

export function LastMinuteChangesWidget() {
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
          ),
          creator:profiles!bookings_created_by_fkey (
            full_name
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
          ),
          creator:profiles!bookings_created_by_fkey (
            full_name
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

      // Combine and format
      const allActivities: RecentActivity[] = [];

      // Add created bookings
      (createdBookings ?? []).forEach((booking: BookingQueryResult) => {
        const creatorName = Array.isArray(booking.creator)
          ? booking.creator[0]?.full_name
          : booking.creator?.full_name;
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
          creator_name: creatorName || null,
          side_name: sideName || 'Unknown',
          side_key: sideKey || 'unknown',
          activity_type: 'created',
          activity_date: booking.created_at,
        });
      });

      // Add edited bookings
      (editedBookings ?? []).forEach((booking: BookingQueryResult) => {
        const creatorName = Array.isArray(booking.creator)
          ? booking.creator[0]?.full_name
          : booking.creator?.full_name;
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
          creator_name: creatorName || null,
          side_name: sideName || 'Unknown',
          side_key: sideKey || 'unknown',
          activity_type: 'edited',
          activity_date: booking.last_edited_at || booking.created_at,
        });
      });

      // Sort by activity date (most recent first) and limit to 10
      return allActivities
        .sort(
          (a, b) =>
            new Date(b.activity_date).getTime() -
            new Date(a.activity_date).getTime()
        )
        .slice(0, 10);
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">
          Recent Booking Activity
        </h3>
        <div className="text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">
          Recent Booking Activity
        </h3>
        <div className="text-sm text-slate-400">
          No booking activity in the last 7 days
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">
          Recent Booking Activity
        </h3>
        <Link
          to="/bookings-team"
          className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {activities.map((activity) => (
          <Link
            key={`${activity.id}-${activity.activity_type}-${activity.activity_date}`}
            to={`/bookings-team?booking=${activity.id}`}
            className="block p-2 rounded hover:bg-slate-800/50 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-200 group-hover:text-white truncate">
                    {activity.title}
                  </p>
                  {activity.last_minute_change && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      Last-Minute
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400 capitalize">
                    {activity.activity_type}
                  </span>
                  <span className="text-xs text-slate-600">•</span>
                  <span className="text-xs text-slate-400">
                    {activity.side_name}
                  </span>
                  {activity.creator_name && (
                    <>
                      <span className="text-xs text-slate-600">•</span>
                      <span className="text-xs text-slate-400">
                        {activity.creator_name}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(activity.activity_date), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
