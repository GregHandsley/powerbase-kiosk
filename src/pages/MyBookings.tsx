import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyBookings, type BookingFilter } from '../hooks/useMyBookings';
import { BookingCard } from '../components/my-bookings/BookingCard';
import { BookingLifecycleModal } from '../components/my-bookings/BookingLifecycleModal';
import { BookingFilters } from '../components/my-bookings/BookingFilters';
import { EditSessionScopeModal } from '../components/my-bookings/EditSessionScopeModal';
import { EditBookingSimpleModal } from '../components/my-bookings/EditBookingSimpleModal';
import { CreateBookingFlowModal } from '../components/schedule/CreateBookingFlowModal';
import { useQueryClient } from '@tanstack/react-query';
import type { BookingWithInstances } from '../hooks/useMyBookings';
import type { BookingStatus } from '../types/db';
import { canEditBooking } from '../utils/bookingPermissions';
import { startOfWeek, endOfWeek, addWeeks } from 'date-fns';

/** Default date range: current week through 6 weeks ahead so new bookings (future sessions) appear. */
function getDefaultDateRange(): { dateFrom: Date; dateTo: Date } {
  const now = new Date();
  return {
    dateFrom: startOfWeek(now, { weekStartsOn: 1 }),
    dateTo: endOfWeek(addWeeks(now, 6), { weekStartsOn: 1 }),
  };
}

const DEFAULT_STATUS: BookingStatus[] = ['pending', 'processed'];

export function MyBookings() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const defaultDateRange = useMemo(() => getDefaultDateRange(), []);

  const [filters, setFilters] = useState<BookingFilter>(() => ({
    status: [...DEFAULT_STATUS],
    side: 'all',
    dateFrom: defaultDateRange.dateFrom,
    dateTo: defaultDateRange.dateTo,
  }));
  const [editingBookingFull, setEditingBookingFull] =
    useState<BookingWithInstances | null>(null);
  const [editingSelectedInstanceIds, setEditingSelectedInstanceIds] = useState<
    number[]
  >([]);
  const [scopeModalBooking, setScopeModalBooking] =
    useState<BookingWithInstances | null>(null);
  const [lifecycleBooking, setLifecycleBooking] =
    useState<BookingWithInstances | null>(null);
  const [showCreateBookingFlow, setShowCreateBookingFlow] = useState(false);

  const {
    data: bookings = [],
    isLoading,
    error,
  } = useMyBookings(user?.id || null, filters);

  const handleEdit = (booking: BookingWithInstances) => {
    const firstInstance = booking.instances[0];
    if (!firstInstance) return;
    if (
      !canEditBooking(
        {
          instanceId: firstInstance.id,
          bookingId: booking.id,
          start: firstInstance.start,
          end: firstInstance.end,
          racks: firstInstance.racks,
          areas: firstInstance.areas,
          title: booking.title,
          color: booking.color,
          isLocked: booking.is_locked,
          createdBy: booking.created_by,
          capacity: firstInstance.capacity,
          status: booking.status,
        },
        user?.id || null,
        role
      )
    ) {
      alert("You don't have permission to edit this booking.");
      return;
    }
    if (booking.instances.length > 1) {
      setScopeModalBooking(booking);
    } else {
      setEditingBookingFull(booking);
      setEditingSelectedInstanceIds([firstInstance.id]);
    }
  };

  const handleScopeConfirm = (instanceIds: number[]) => {
    if (!scopeModalBooking) return;
    setEditingSelectedInstanceIds(instanceIds);
    setEditingBookingFull(scopeModalBooking);
    setScopeModalBooking(null);
  };

  const handleSimpleEditClose = () => {
    setEditingBookingFull(null);
    setEditingSelectedInstanceIds([]);
    queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-slate-400">
          Please log in to view your bookings.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white">My Bookings</h1>
          <button
            type="button"
            onClick={() => setShowCreateBookingFlow(true)}
            className="rounded-xl border border-indigo-500 bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            Create Booking
          </button>
        </div>

        <BookingFilters
          filters={filters}
          onFiltersChange={setFilters}
          defaultFilters={{
            status: [...DEFAULT_STATUS],
            side: 'all',
            dateFrom: defaultDateRange.dateFrom,
            dateTo: defaultDateRange.dateTo,
          }}
        />

        {isLoading && (
          <div className="text-center py-12 text-slate-400">
            Loading your bookings...
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
            <div className="text-slate-400 mb-4">No bookings found.</div>
            <a
              href="/schedule"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Create your first booking →
            </a>
          </div>
        )}

        {!isLoading && !error && bookings.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400 mb-4">
              Showing {bookings.length} booking
              {bookings.length !== 1 ? 's' : ''}
            </div>
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onEdit={handleEdit}
                onViewLifecycle={setLifecycleBooking}
              />
            ))}
          </div>
        )}
      </>

      {scopeModalBooking && (
        <EditSessionScopeModal
          booking={scopeModalBooking}
          isOpen
          onClose={() => setScopeModalBooking(null)}
          onConfirm={handleScopeConfirm}
        />
      )}

      {editingBookingFull && editingSelectedInstanceIds.length > 0 && (
        <EditBookingSimpleModal
          key={`${editingBookingFull.id}-${editingSelectedInstanceIds.join(',')}`}
          booking={editingBookingFull}
          selectedInstanceIds={editingSelectedInstanceIds}
          isOpen
          onClose={handleSimpleEditClose}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['snapshot'] });
          }}
        />
      )}

      <BookingLifecycleModal
        booking={lifecycleBooking}
        isOpen={!!lifecycleBooking}
        onClose={() => setLifecycleBooking(null)}
      />

      <CreateBookingFlowModal
        isOpen={showCreateBookingFlow}
        onClose={() => setShowCreateBookingFlow(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
          queryClient.invalidateQueries({ queryKey: ['snapshot'] });
        }}
        role={role ?? 'bookings_team'}
      />
    </div>
  );
}
