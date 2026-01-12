import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  useBookingsTeam,
  type BookingsTeamFilter,
  type BookingForTeam,
} from '../hooks/useBookingsTeam';
import { BookingsTeamFilters } from '../components/bookings-team/BookingsTeamFilters';
import { BookingTeamCard } from '../components/bookings-team/BookingTeamCard';
import { BookingDetailModal } from '../components/bookings-team/BookingDetailModal';
import { LastMinuteChangesWidget } from '../components/bookings-team/LastMinuteChangesWidget';
import { ConfirmationDialog } from '../components/shared/ConfirmationDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { deleteTasksForBooking } from '../hooks/useTasks';

function InfoTooltip({ content }: { content: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="ml-1 text-slate-400 hover:text-slate-300 transition-colors"
        aria-label="Information"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
      {show && (
        <div className="absolute z-10 w-64 p-3 mt-2 text-xs text-slate-200 bg-slate-900 border border-slate-700 rounded-lg shadow-lg left-0">
          {content}
        </div>
      )}
    </div>
  );
}

export function BookingsTeam() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<BookingsTeamFilter>({
    status: 'pending', // Default to pending
    side: 'all',
  });
  const [selectedBookings, setSelectedBookings] = useState<Set<number>>(
    new Set()
  );
  const [viewingBooking, setViewingBooking] = useState<BookingForTeam | null>(
    null
  );
  const [processingBooking, setProcessingBooking] =
    useState<BookingForTeam | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Check if user has access (admin or bookings_team role)
  const hasAccess = role === 'admin'; // TODO: Add "bookings_team" role check when implemented

  // Fetch bookings
  const { data: bookings = [], isLoading, error } = useBookingsTeam(filters);

  // Fetch coaches for filter dropdown
  const { data: coaches = [] } = useQuery({
    queryKey: ['coaches-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'coach')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Error fetching coaches:', error);
        return [];
      }

      return (data || []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
      }));
    },
  });

  const handleProcessBooking = async (booking: BookingForTeam) => {
    if (!user) return;

    setProcessing(true);
    try {
      // Create snapshot of current state
      const firstInstance = booking.instances[0];
      const allRacks = new Set<number>();
      booking.instances.forEach((inst) => {
        inst.racks.forEach((rack) => allRacks.add(rack));
      });

      const snapshot = {
        instanceCount: booking.instances.length,
        firstInstanceStart: firstInstance?.start || '',
        firstInstanceEnd: firstInstance?.end || '',
        firstInstanceCapacity: firstInstance?.capacity, // Keep for backward compatibility
        firstInstanceRacks: firstInstance?.racks || [], // Keep for backward compatibility
        allRacks: Array.from(allRacks).sort((a, b) => a - b),
        // Store all instance start dates for accurate deletion detection
        allInstanceStarts: booking.instances.map((inst) => inst.start).sort(),
        // Store all instance times for accurate time change detection
        allInstanceTimes: booking.instances
          .map((inst) => ({
            start: inst.start,
            end: inst.end,
          }))
          .sort((a, b) => a.start.localeCompare(b.start)),
        // Store capacity for each instance by date (for accurate change detection after reprocessing)
        allInstanceCapacities: booking.instances
          .map((inst) => ({
            start: inst.start,
            capacity: inst.capacity ?? 1,
          }))
          .sort((a, b) => a.start.localeCompare(b.start)),
        // Store racks for each instance by date (for accurate change detection after reprocessing)
        allInstanceRacks: booking.instances
          .map((inst) => ({
            start: inst.start,
            racks: inst.racks || [],
          }))
          .sort((a, b) => a.start.localeCompare(b.start)),
      };

      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'processed',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
          processed_snapshot: snapshot,
        })
        .eq('id', booking.id);

      if (error) {
        throw new Error(error.message);
      }

      // Delete tasks related to this booking since it's now processed/resolved
      await deleteTasksForBooking(booking.id);

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['bookings-team'] });
      await queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      await queryClient.invalidateQueries({ queryKey: ['snapshot'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });

      setProcessingBooking(null);
      setViewingBooking(null);
    } catch (err) {
      console.error('Failed to process booking:', err);
      alert(err instanceof Error ? err.message : 'Failed to process booking');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkProcess = async () => {
    if (!user || selectedBookings.size === 0) return;

    setBulkProcessing(true);
    try {
      const bookingIds = Array.from(selectedBookings);

      // Get bookings to create snapshots
      const bookingsToProcess = bookings.filter((b) =>
        bookingIds.includes(b.id)
      );

      // Process each booking with its snapshot
      const updates = bookingsToProcess.map(async (booking) => {
        const firstInstance = booking.instances[0];
        const allRacks = new Set<number>();
        booking.instances.forEach((inst) => {
          inst.racks.forEach((rack) => allRacks.add(rack));
        });

        const snapshot = {
          instanceCount: booking.instances.length,
          firstInstanceStart: firstInstance?.start || '',
          firstInstanceEnd: firstInstance?.end || '',
          firstInstanceCapacity: firstInstance?.capacity, // Keep for backward compatibility
          firstInstanceRacks: firstInstance?.racks || [], // Keep for backward compatibility
          allRacks: Array.from(allRacks).sort((a, b) => a - b),
          // Store all instance start dates for accurate deletion detection
          allInstanceStarts: booking.instances.map((inst) => inst.start).sort(),
          // Store all instance times for accurate time change detection
          allInstanceTimes: booking.instances
            .map((inst) => ({
              start: inst.start,
              end: inst.end,
            }))
            .sort((a, b) => a.start.localeCompare(b.start)),
          // Store capacity for each instance by date (for accurate change detection after reprocessing)
          allInstanceCapacities: booking.instances
            .map((inst) => ({
              start: inst.start,
              capacity: inst.capacity ?? 1,
            }))
            .sort((a, b) => a.start.localeCompare(b.start)),
          // Store racks for each instance by date (for accurate change detection after reprocessing)
          allInstanceRacks: booking.instances
            .map((inst) => ({
              start: inst.start,
              racks: inst.racks || [],
            }))
            .sort((a, b) => a.start.localeCompare(b.start)),
        };

        return supabase
          .from('bookings')
          .update({
            status: 'processed',
            processed_by: user.id,
            processed_at: new Date().toISOString(),
            processed_snapshot: snapshot,
          })
          .eq('id', booking.id);
      });

      const results = await Promise.all(updates);
      const error = results.find((r) => r.error)?.error;

      if (error) {
        throw new Error(error.message);
      }

      // Delete tasks for all processed bookings
      await Promise.all(bookingIds.map((id) => deleteTasksForBooking(id)));

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['bookings-team'] });
      await queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      await queryClient.invalidateQueries({ queryKey: ['snapshot'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });

      setSelectedBookings(new Set());
    } catch (err) {
      console.error('Failed to bulk process bookings:', err);
      alert(err instanceof Error ? err.message : 'Failed to process bookings');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleSelectBooking = (bookingId: number, selected: boolean) => {
    setSelectedBookings((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(bookingId);
      } else {
        next.delete(bookingId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const pendingBookings = bookings.filter((b) => b.status === 'pending');
    if (selectedBookings.size === pendingBookings.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(pendingBookings.map((b) => b.id)));
    }
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-300">
          You don't have permission to access the Bookings Team dashboard.
        </div>
      </div>
    );
  }

  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const selectedPendingCount = bookings.filter(
    (b) => b.status === 'pending' && selectedBookings.has(b.id)
  ).length;

  // Calculate valuable metrics
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Urgent: Pending bookings with instances happening in next 7 days
  const urgentCount = bookings.filter((b) => {
    if (b.status !== 'pending') return false;
    return b.instances.some((inst) => {
      const instStart = new Date(inst.start);
      return instStart >= now && instStart <= sevenDaysFromNow;
    });
  }).length;

  // Today's new bookings
  const todayNewCount = bookings.filter((b) => {
    const created = new Date(b.created_at);
    return created >= todayStart && created <= todayEnd;
  }).length;

  // Today processed
  const todayProcessedCount = bookings.filter((b) => {
    if (!b.processed_at) return false;
    const processed = new Date(b.processed_at);
    return processed >= todayStart && processed <= todayEnd;
  }).length;

  // Processing health: ratio of processed to pending (last 7 days)
  const last7DaysStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentProcessed = bookings.filter((b) => {
    if (!b.processed_at) return false;
    const processed = new Date(b.processed_at);
    return processed >= last7DaysStart;
  }).length;
  const recentPending = bookings.filter((b) => {
    if (b.status !== 'pending') return false;
    const created = new Date(b.created_at);
    return created >= last7DaysStart;
  }).length;
  const processingHealth =
    recentPending > 0
      ? Math.round((recentProcessed / (recentProcessed + recentPending)) * 100)
      : 100;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          Bookings Team Dashboard
        </h1>
        <p className="text-slate-400">
          Manage and process booking requests. Filter by status, date, coach, or
          side.
        </p>
      </div>

      {/* Stats - Actionable Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Urgent - Most Important */}
        {urgentCount > 0 && (
          <div className="bg-red-900/30 border-2 border-red-600 rounded-lg p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-600/20 rounded-full -mr-10 -mt-10"></div>
            <div className="relative">
              <div className="text-sm text-red-400 mb-1 font-medium">
                ⚠️ Urgent
              </div>
              <div className="text-3xl font-bold text-red-300">
                {urgentCount}
              </div>
              <div className="text-xs text-red-400/70 mt-1">
                Happening in next 7 days
              </div>
            </div>
          </div>
        )}

        {/* Pending */}
        <div
          className={`rounded-lg p-4 ${urgentCount > 0 ? 'bg-yellow-900/20 border border-yellow-700' : 'bg-yellow-900/30 border-2 border-yellow-600'}`}
        >
          <div className="text-sm text-yellow-400 mb-1 font-medium">
            Pending
          </div>
          <div className="text-3xl font-bold text-yellow-300">
            {pendingCount}
          </div>
          <div className="text-xs text-yellow-400/70 mt-1">
            Awaiting processing
          </div>
        </div>

        {/* Today's Activity */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <div className="text-sm text-blue-400 mb-1 font-medium">Today</div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-blue-300">
              {todayNewCount}
            </div>
            <div className="text-sm text-blue-400/70">new</div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-2xl font-bold text-green-300">
              {todayProcessedCount}
            </div>
            <div className="text-sm text-green-400/70">processed</div>
          </div>
        </div>

        {/* Processing Health */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center text-sm text-slate-400 mb-1 font-medium">
            Processing Health
            <InfoTooltip content="Shows how well you're keeping up with bookings. Calculated as: (Processed in last 7 days) / (Processed + Pending created in last 7 days). Green (80%+) means you're on top of it, Yellow (50-79%) means catching up, Red (<50%) means falling behind." />
          </div>
          <div className="flex items-baseline gap-2">
            <div
              className={`text-3xl font-bold ${processingHealth >= 80 ? 'text-green-300' : processingHealth >= 50 ? 'text-yellow-300' : 'text-red-300'}`}
            >
              {processingHealth}%
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-1">Last 7 days</div>
          <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                processingHealth >= 80
                  ? 'bg-green-500'
                  : processingHealth >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${processingHealth}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Last-Minute Changes Widget */}
      <div className="mb-6">
        <LastMinuteChangesWidget />
      </div>

      {/* Filters */}
      <BookingsTeamFilters
        filters={filters}
        onFiltersChange={setFilters}
        coaches={coaches}
      />

      {/* Bulk Actions */}
      {selectedBookings.size > 0 && (
        <div className="mt-4 bg-indigo-900/20 border border-indigo-700 rounded-lg p-4 flex items-center justify-between">
          <div className="text-sm text-indigo-300">
            {selectedBookings.size} booking
            {selectedBookings.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
            >
              {selectedPendingCount === pendingCount
                ? 'Deselect All'
                : 'Select All Pending'}
            </button>
            <button
              type="button"
              onClick={handleBulkProcess}
              disabled={bulkProcessing || selectedPendingCount === 0}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {bulkProcessing
                ? 'Processing...'
                : `Process ${selectedPendingCount} Pending`}
            </button>
          </div>
        </div>
      )}

      {/* Bookings List */}
      {isLoading && (
        <div className="text-center py-12 text-slate-400">
          Loading bookings...
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-300">
          Error loading bookings:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {!isLoading && !error && bookings.length === 0 && (
        <div className="text-center py-12">
          <div className="text-slate-400 mb-4">
            No bookings found matching your filters.
          </div>
        </div>
      )}

      {!isLoading && !error && bookings.length > 0 && (
        <div className="space-y-4 mt-6">
          <div className="text-sm text-slate-400 mb-4">
            Showing {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
          </div>
          {bookings.map((booking) => (
            <BookingTeamCard
              key={booking.id}
              booking={booking}
              onView={setViewingBooking}
              onProcess={setProcessingBooking}
              isSelected={selectedBookings.has(booking.id)}
              onSelect={handleSelectBooking}
            />
          ))}
        </div>
      )}

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={viewingBooking}
        isOpen={!!viewingBooking}
        onClose={() => setViewingBooking(null)}
        onProcess={handleProcessBooking}
        processing={processing}
      />

      {/* Process Confirmation */}
      {processingBooking && (
        <ConfirmationDialog
          isOpen={!!processingBooking}
          title="Mark as Processed"
          message={`Are you sure you want to mark "${processingBooking.title}" as processed?`}
          confirmLabel="Process"
          cancelLabel="Cancel"
          onConfirm={() => handleProcessBooking(processingBooking)}
          onCancel={() => setProcessingBooking(null)}
          confirmVariant="primary"
        />
      )}
    </div>
  );
}
