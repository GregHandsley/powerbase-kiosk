import { useMemo, useState, useEffect } from 'react';
import { addDays, format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  generateTimeSlots,
  formatTimeSlot,
  type TimeSlot,
} from '../components/admin/capacity/scheduleUtils';
import { isTimeSlotInPast } from '../components/admin/booking/utils';
import {
  usePermission,
  usePrimaryOrganizationId,
} from '../hooks/usePermissions';

type SlotCapacityData = {
  availablePlatforms: Set<number> | null;
  isClosed: boolean;
  periodType: string | null;
  periodEndTime?: string;
};
import { ScheduleGrid } from '../components/schedule/ScheduleGrid';
import { SessionBookingInfoModal } from '../components/schedule/SessionBookingInfoModal';
import { DayNavigationHeader } from '../components/schedule/DayNavigationHeader';
import {
  makeBaseLayout,
  makePowerLayout,
} from '../components/schedule/shared/layouts';
import { useScheduleDayCapacity } from '../components/schedule/hooks/useScheduleDayCapacity';
import { calculateCapacityExceededSlots } from '../components/schedule/grid/utils/capacityExceeded';
import type { ScheduleData } from '../components/admin/capacity/scheduleUtils';
import { CreateBookingFlowModal } from '../components/schedule/CreateBookingFlowModal';
import { EditSessionScopeModal } from '../components/my-bookings/EditSessionScopeModal';
import { EditBookingSimpleModal } from '../components/my-bookings/EditBookingSimpleModal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { getAreaSlotsForInstances } from '../nodes/data/areaSlotsNodes';
import type { ActiveInstance } from '../types/snapshot';
import { canEditBooking } from '../utils/bookingPermissions';
import {
  useBookingWithInstances,
  type BookingWithInstances,
} from '../hooks/useMyBookings';

type NewBookingContext = {
  date: Date;
  timeSlot: TimeSlot;
  rack: number;
  side: 'Power' | 'Base';
  selectedRacks?: number[]; // For drag selection
  endTimeSlot?: TimeSlot; // For drag selection end time
} | null;

/** Default end time 90 minutes after start (15-min rounded). */
function getDefaultEndTimeFromSlot(start: TimeSlot): string {
  const totalM = start.hour * 60 + start.minute + 90;
  const h = Math.floor(totalM / 60) % 24;
  const m = totalM % 60;
  const rounded = Math.round(m / 15) * 15;
  const finalM = rounded === 60 ? 0 : rounded;
  const finalH = rounded === 60 ? h + 1 : h;
  return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
}

export function Schedule() {
  const { user, role } = useAuth();
  const [selectedSide, setSelectedSide] = useState<'Power' | 'Base'>('Power');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newBookingContext, setNewBookingContext] =
    useState<NewBookingContext>(null);
  /** When user clicks a booking we fetch by id; when loaded we open scope or edit modal */
  const [pendingEditBookingId, setPendingEditBookingId] = useState<
    number | null
  >(null);
  /** Master view: double-click opens read-only view (racks + areas). */
  const [viewingBooking, setViewingBooking] = useState<ActiveInstance | null>(
    null
  );
  const [scopeModalBooking, setScopeModalBooking] =
    useState<BookingWithInstances | null>(null);
  const [editingBookingFull, setEditingBookingFull] =
    useState<BookingWithInstances | null>(null);
  const [editingSelectedInstanceIds, setEditingSelectedInstanceIds] = useState<
    number[]
  >([]);
  const queryClient = useQueryClient();
  const allTimeSlots = generateTimeSlots();
  const sideKey = selectedSide === 'Power' ? 'power' : 'base';

  /** 'master' = one block per booking using master start/end (same colours); 'platforms' = per-platform times from area_slots */
  const [scheduleViewMode, setScheduleViewMode] = useState<
    'master' | 'platforms'
  >('master');

  const { data: fetchedBookingForEdit } =
    useBookingWithInstances(pendingEditBookingId);

  // When we've fetched a booking for edit, open scope modal (block) or edit modal (single)
  useEffect(() => {
    if (!pendingEditBookingId || !fetchedBookingForEdit) return;
    if (fetchedBookingForEdit.instances.length > 1) {
      setScopeModalBooking(fetchedBookingForEdit);
    } else {
      const inst = fetchedBookingForEdit.instances[0];
      if (inst) {
        setEditingBookingFull(fetchedBookingForEdit);
        setEditingSelectedInstanceIds([inst.id]);
      }
    }
    setPendingEditBookingId(null);
  }, [pendingEditBookingId, fetchedBookingForEdit]);

  // Get capacity data for the day
  const {
    sideId,
    slotCapacityData,
    isLoading: capacityLoading,
    capacitySchedules,
  } = useScheduleDayCapacity({
    side: sideKey,
    date: currentDate,
    timeSlots: allTimeSlots,
  });

  // Filter time slots to only show available ones (exclude closed periods)
  // Also create a mapping from filtered index to original index for capacity data lookups
  const { timeSlots, slotIndexMap } = useMemo(() => {
    const availableSlots: typeof allTimeSlots = [];
    const indexMap = new Map<number, number>(); // filtered index -> original index

    allTimeSlots.forEach((slot, originalIndex) => {
      const capacityData = slotCapacityData.get(originalIndex);
      const isClosed = capacityData?.isClosed ?? false;

      // Only include slots that are not closed
      if (!isClosed) {
        const filteredIndex = availableSlots.length;
        availableSlots.push(slot);
        indexMap.set(filteredIndex, originalIndex);
      }
    });

    return { timeSlots: availableSlots, slotIndexMap: indexMap };
  }, [allTimeSlots, slotCapacityData]);

  // Create a filtered slotCapacityData map using filtered indices
  const filteredSlotCapacityData = useMemo(() => {
    const filtered = new Map<number, SlotCapacityData>();
    slotIndexMap.forEach((originalIndex, filteredIndex) => {
      const capacityData = slotCapacityData.get(originalIndex);
      if (capacityData) {
        filtered.set(filteredIndex, capacityData);
      }
    });
    return filtered;
  }, [slotIndexMap, slotCapacityData]);

  // Get racks from layout definitions (same approach as LiveView)
  const rackNumbers = useMemo(() => {
    const layout =
      selectedSide === 'Base' ? makeBaseLayout() : makePowerLayout();
    // Extract unique rack numbers, filtering out null (platforms) and disabled racks
    const racks = layout
      .filter((row) => row.rackNumber !== null && !row.disabled)
      .map((row) => row.rackNumber as number)
      .sort((a, b) => a - b);
    return racks;
  }, [selectedSide]);

  const navigateDay = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => addDays(prev, direction === 'next' ? 1 : -1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Fetch bookings for the selected date
  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const startOfDay = new Date(currentDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(currentDate);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['schedule-bookings', sideId, dateStr],
    queryFn: async () => {
      if (!sideId) return [];

      const { data, error } = await supabase
        .from('booking_instances')
        .select(
          `
          id,
          booking_id,
          side_id,
          start,
          "end",
          racks,
          areas,
          capacity,
          booking:bookings (
            title,
            color,
            is_locked,
            created_by,
            status
          )
        `
        )
        .eq('side_id', sideId)
        .lt('start', endOfDay.toISOString()) // instance starts before end of day
        .gt('end', startOfDay.toISOString()) // instance ends after start of day
        .order('start', { ascending: true });

      if (error) {
        console.error('[Schedule] Error fetching bookings:', error);
        return [];
      }

      // Filter out cancelled bookings (but keep pending_cancellation until confirmed)
      // Supabase doesn't support filtering on joined table fields
      const validBookings = (data ?? []).filter((row: unknown) => {
        const r = row as {
          booking_id?: number;
          booking?: { status?: string; title?: string | null } | null;
        };
        const status = r.booking?.status;
        // Only exclude fully cancelled bookings
        // pending_cancellation bookings should still appear and block capacity until confirmed
        // If status is undefined/null, include it (backward compatibility)
        if (!status) return true;
        const isCancelled = status === 'cancelled';
        if (isCancelled) {
          console.log('[Schedule] Filtering out cancelled booking:', {
            bookingId: r.booking_id,
            status,
            title: r.booking?.title || 'Untitled',
          });
        }
        return !isCancelled;
      });

      // Fetch area_slots so schedule can show per-rack times (e.g. racks 09:00–10:00 within 09:00–10:30 instance)
      const instanceIds = validBookings.map(
        (row: unknown) => (row as { id: number }).id
      );
      const slotsByInstance = await getAreaSlotsForInstances(instanceIds);

      // Normalize to ActiveInstance format
      return validBookings.map((row: unknown) => {
        const r = row as {
          id: number;
          booking_id: number;
          start: string;
          end: string;
          racks: number[] | unknown;
          areas: string[] | unknown;
          capacity?: number;
          booking?: {
            title?: string | null;
            color?: string | null;
            is_locked?: boolean;
            created_by?: string | null;
            status?: string;
          } | null;
        };
        const areaSlotsRaw = slotsByInstance[r.id] ?? [];
        const area_slots = areaSlotsRaw.map((s) => ({
          area_key: s.area_key,
          start: s.start,
          end: s.end,
        }));
        return {
          instanceId: r.id,
          bookingId: r.booking_id,
          start: r.start,
          end: r.end,
          racks: Array.isArray(r.racks) ? r.racks : [],
          areas: Array.isArray(r.areas) ? r.areas : [],
          title: r.booking?.title ?? 'Untitled',
          color: r.booking?.color ?? null,
          isLocked: r.booking?.is_locked ?? false,
          createdBy: r.booking?.created_by ?? null,
          capacity: typeof r.capacity === 'number' ? r.capacity : undefined,
          status: r.booking?.status as ActiveInstance['status'],
          area_slots: area_slots.length > 0 ? area_slots : undefined,
        };
      }) as ActiveInstance[];
    },
    enabled: !!sideId,
  });

  // Calculate capacity-exceeded slots (after bookings are fetched)
  const capacityExceededBySlot = useMemo(() => {
    if (
      !sideId ||
      !capacitySchedules ||
      capacitySchedules.length === 0 ||
      bookings.length === 0
    ) {
      return new Map<number, Set<number>>();
    }

    return calculateCapacityExceededSlots(
      timeSlots,
      currentDate,
      bookings,
      capacitySchedules as ScheduleData[]
    );
  }, [sideId, capacitySchedules, timeSlots, currentDate, bookings]);

  // Check permissions for creating bookings
  const { organizationId: primaryOrgId } = usePrimaryOrganizationId();
  const { hasPermission: canCreateBookings } = usePermission(
    primaryOrgId,
    'bookings.create'
  );

  const handleCellClick = (rack: number, timeSlot: TimeSlot) => {
    // Prevent clicking on past times
    if (isTimeSlotInPast(currentDate, timeSlot)) {
      return;
    }

    // Check permission before opening create modal
    if (!canCreateBookings) {
      return;
    }

    // Open the create booking modal with pre-filled values
    setNewBookingContext({
      date: currentDate,
      timeSlot,
      rack,
      side: selectedSide,
    });
  };

  const handleDragSelection = (selection: {
    startTimeSlot: TimeSlot;
    endTimeSlot: TimeSlot;
    racks: number[];
  }) => {
    // Open the create booking modal with the drag selection
    // Use the first rack and start time for the initial context
    // The form will be pre-filled with all selected racks
    setNewBookingContext({
      date: currentDate,
      timeSlot: selection.startTimeSlot,
      rack: selection.racks[0], // Use first rack for context
      side: selectedSide,
      selectedRacks: selection.racks, // Pass all selected racks
      endTimeSlot: selection.endTimeSlot, // Pass end time
    });
  };

  const handleCloseNewBookingModal = () => {
    setNewBookingContext(null);
    // Refresh bookings after closing (in case a booking was created)
    queryClient.invalidateQueries({
      queryKey: ['schedule-bookings'],
      exact: false,
    });
  };

  const handleEditBooking = (booking: ActiveInstance) => {
    if (!canEditBooking(booking, user?.id || null, role)) {
      alert(
        "You don't have permission to edit this booking. Only the coach who created it or an admin can edit it."
      );
      return;
    }
    setPendingEditBookingId(booking.bookingId);
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
    queryClient.invalidateQueries({
      queryKey: ['schedule-bookings'],
      exact: false,
    });
  };

  return (
    <div className="h-full min-h-0 overflow-hidden p-4">
      <div className="flex h-full min-h-0 flex-col gap-4">
        {/* Header */}
        <header className="flex shrink-0 flex-col gap-4">
          <div>
            <h1 className="text-lg font-semibold">Schedule</h1>
            <p className="text-sm text-slate-300">
              Manage bookings and availability by rack and time.
            </p>
          </div>

          {/* Day Navigation + View mode on one row */}
          <DayNavigationHeader
            currentDate={currentDate}
            selectedSide={selectedSide}
            onNavigateDay={navigateDay}
            onGoToToday={goToToday}
            onSideChange={setSelectedSide}
            onDateChange={setCurrentDate}
            trailing={
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-slate-300">View:</span>
                <div className="flex rounded-md border border-slate-600 bg-slate-950 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('master')}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      scheduleViewMode === 'master'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Show booking master time range (same colours)"
                  >
                    Bookings
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('platforms')}
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      scheduleViewMode === 'platforms'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Show per-platform allocated times"
                  >
                    Platforms
                  </button>
                </div>
              </div>
            }
          />
        </header>

        {/* Schedule Grid */}
        <div className="flex-1 min-h-0">
          {bookingsLoading || capacityLoading ? (
            <div className="flex h-full items-center justify-center p-8">
              <p className="text-sm text-slate-400">Loading...</p>
            </div>
          ) : (
            <ScheduleGrid
              racks={rackNumbers}
              timeSlots={timeSlots}
              selectedSide={selectedSide}
              bookings={bookings}
              currentDate={currentDate}
              slotCapacityData={filteredSlotCapacityData}
              capacityExceededBySlot={capacityExceededBySlot}
              onCellClick={handleCellClick}
              onBookingClick={handleEditBooking}
              onBookingDoubleClick={
                scheduleViewMode === 'master'
                  ? (booking) => setViewingBooking(booking)
                  : undefined
              }
              onDragSelection={handleDragSelection}
              viewMode={scheduleViewMode}
            />
          )}
        </div>

        {/* Create booking flow (from cell/drag) */}
        {newBookingContext && (
          <CreateBookingFlowModal
            isOpen={!!newBookingContext}
            onClose={handleCloseNewBookingModal}
            onSuccess={handleCloseNewBookingModal}
            role={role || 'snc_coach'}
            initialDate={format(newBookingContext.date, 'yyyy-MM-dd')}
            initialStartTime={formatTimeSlot(newBookingContext.timeSlot)}
            initialEndTime={
              newBookingContext.endTimeSlot
                ? formatTimeSlot(newBookingContext.endTimeSlot)
                : getDefaultEndTimeFromSlot(newBookingContext.timeSlot)
            }
            initialSide={newBookingContext.side}
            initialRacks={
              newBookingContext.selectedRacks ?? [newBookingContext.rack]
            }
          />
        )}

        {scopeModalBooking && (
          <EditSessionScopeModal
            booking={scopeModalBooking}
            isOpen={true}
            onClose={() => setScopeModalBooking(null)}
            onConfirm={handleScopeConfirm}
          />
        )}

        {editingBookingFull && (
          <EditBookingSimpleModal
            booking={editingBookingFull}
            selectedInstanceIds={editingSelectedInstanceIds}
            isOpen={true}
            onClose={handleSimpleEditClose}
            onSaved={handleSimpleEditClose}
          />
        )}

        {/* Master view: read-only booking details (racks + areas) */}
        <SessionBookingInfoModal
          booking={viewingBooking}
          side={sideKey}
          isOpen={!!viewingBooking}
          onClose={() => setViewingBooking(null)}
        />
      </div>
    </div>
  );
}
