// src/pages/LiveView.tsx
import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnapshotFromSearchParams } from '../hooks/useSnapshotFromSearchParams';
import { Clock } from '../components/Clock';
import { RackListEditor } from '../components/schedule/RackListEditor';
import { useLiveViewCapacity } from '../components/schedule/hooks/useLiveViewCapacity';
// import { isSessionInPast } from '../components/admin/booking/utils';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { CreateBookingFlowModal } from '../components/schedule/CreateBookingFlowModal';
import { EditSessionScopeModal } from '../components/my-bookings/EditSessionScopeModal';
import { EditBookingSimpleModal } from '../components/my-bookings/EditBookingSimpleModal';
import {
  useBookingWithInstances,
  type BookingWithInstances,
} from '../hooks/useMyBookings';
import { canEditBooking } from '../utils/bookingPermissions';
import type { ActiveInstance } from '../types/snapshot';

type SideMode = 'power' | 'base';

/** Add 90 minutes to HH:mm, return HH:mm on 15-min interval. */
function add90Minutes(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + 90;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  const rounded = Math.round(endM / 15) * 15;
  const finalM = rounded === 60 ? 0 : rounded;
  const finalH = rounded === 60 ? endH + 1 : endH;
  return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
}

export function LiveView() {
  const { date, time, power, base, update, searchParams, setSearchParams } =
    useSnapshotFromSearchParams();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const sideParam = (searchParams.get('side') ?? 'power').toLowerCase();
  const initialSide: SideMode = sideParam === 'base' ? 'base' : 'power';

  const [sideMode, setSideMode] = useState<SideMode>(initialSide);
  const [timeInput, setTimeInput] = useState(time);

  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [pendingEditBookingId, setPendingEditBookingId] = useState<
    number | null
  >(null);
  const [scopeModalBooking, setScopeModalBooking] =
    useState<BookingWithInstances | null>(null);
  const [editingBookingFull, setEditingBookingFull] =
    useState<BookingWithInstances | null>(null);
  const [editingSelectedInstanceIds, setEditingSelectedInstanceIds] = useState<
    number[]
  >([]);

  const { data: fetchedBookingForEdit } =
    useBookingWithInstances(pendingEditBookingId);

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

  const invalidateSessionView = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['snapshot'] });
    queryClient.invalidateQueries({ queryKey: ['live-view-capacity-usage'] });
  }, [queryClient]);

  // keep local time input in sync with URL-derived time
  useEffect(() => {
    setTimeInput(time);
  }, [time]);

  // keep URL side param in sync when toggling
  const setSideModeAndUrl = useCallback(
    (mode: SideMode) => {
      setSideMode(mode);
      const params = new URLSearchParams(searchParams);
      params.set('side', mode);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleDateChange = (newDate: string) => {
    const safeDate = newDate || date;
    update(safeDate, time);
  };

  const handleTimeChange = (newTime: string) => {
    setTimeInput(newTime);
    if (/^\d{2}:\d{2}$/.test(newTime)) {
      update(date, newTime);
    }
  };

  // const selectedSnapshot = sideMode === 'power' ? power : base;

  // Get capacity information for the selected date/time
  const { applicableSchedule, sideId } = useLiveViewCapacity({
    side: sideMode,
    date,
    time,
  });

  // Calculate current capacity usage at the selected time
  // Include applicableSchedule in query key so it refetches when schedule changes (e.g., when date changes)
  const { data: currentCapacityUsage } = useQuery({
    queryKey: [
      'live-view-capacity-usage',
      sideId,
      date,
      time,
      applicableSchedule?.id,
      applicableSchedule?.capacity,
    ],
    queryFn: async () => {
      if (!sideId || !date || !time) return { used: 0, limit: null };

      // Combine date and time to get the exact datetime
      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute] = time.split(':').map(Number);
      const selectedDateTime = new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        0,
        0
      );

      // Fetch all booking instances that overlap with this time
      const { data: instances, error } = await supabase
        .from('booking_instances')
        .select('id, start, end, capacity')
        .eq('side_id', sideId)
        .lte('start', selectedDateTime.toISOString())
        .gt('end', selectedDateTime.toISOString());

      if (error) {
        console.error('Error fetching capacity usage:', error);
        return { used: 0, limit: null };
      }

      // Sum up the capacity from all overlapping instances
      const used = (instances ?? []).reduce((sum, inst) => {
        return sum + ((inst as { capacity?: number }).capacity || 0);
      }, 0);

      const limit = applicableSchedule?.capacity ?? null;

      return { used, limit };
    },
    enabled: !!sideId && !!date && !!time,
  });

  const periodType = applicableSchedule?.period_type ?? null;
  const capacityLimit = currentCapacityUsage?.limit ?? null;
  const capacityUsed = currentCapacityUsage?.used ?? 0;

  // Check if the session is in the past
  // const isPastSession = useMemo(
  //   () => isSessionInPast(date, time),
  //   [date, time]
  // );

  const sideKeyForModal: 'Power' | 'Base' =
    sideMode === 'base' ? 'Base' : 'Power';

  const handleEditBooking = useCallback(
    (booking: ActiveInstance) => {
      if (!canEditBooking(booking, user?.id ?? null, role)) {
        alert(
          "You don't have permission to edit this booking. Only the coach who created it or an admin can edit it."
        );
        return;
      }
      setPendingEditBookingId(booking.bookingId);
    },
    [user?.id, role]
  );

  const handleScopeConfirm = useCallback((instanceIds: number[]) => {
    setScopeModalBooking((b) => {
      if (!b) return null;
      setEditingSelectedInstanceIds(instanceIds);
      setEditingBookingFull(b);
      return null;
    });
  }, []);

  const handleSimpleEditClose = useCallback(() => {
    setEditingBookingFull(null);
    setEditingSelectedInstanceIds([]);
    invalidateSessionView();
  }, [invalidateSessionView]);

  return (
    <div className="h-full min-h-0 overflow-hidden p-4 flex flex-col gap-4">
      {/* Header / Controls */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Session View</h1>
          <p className="text-sm text-slate-300">
            View platform allocations for a specific date and time.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3 text-xs">
          {/* Add booking - matches size of Date/Time/Side controls */}
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={() => setShowCreateBooking(true)}
              className="rounded-md border border-indigo-600 bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              Add booking
            </button>
          </div>
          {/* Date/time controls */}
          <div className="flex flex-col">
            <label className="mb-1 text-slate-300">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-slate-300">Time</label>
            <input
              type="time"
              value={timeInput}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Side toggle */}
          <div className="flex flex-col">
            <span className="mb-1 text-slate-300">Side</span>
            <div className="inline-flex rounded-md border border-slate-600 bg-slate-950 overflow-hidden">
              <button
                type="button"
                onClick={() => setSideModeAndUrl('power')}
                className={`px-2 py-1 ${
                  sideMode === 'power'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Power
              </button>
              <button
                type="button"
                onClick={() => setSideModeAndUrl('base')}
                className={`px-2 py-1 ${
                  sideMode === 'base'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Base
              </button>
            </div>
          </div>

          {/* Live clock */}
          <div className="flex flex-col">
            <span className="mb-1 text-slate-300">Now</span>
            <div className="px-2 py-1 rounded-md border border-slate-700 bg-slate-900 text-xs flex items-center gap-2">
              <Clock />
            </div>
          </div>
        </div>
      </header>

      {/* Period Type and Capacity Info */}
      {(periodType || capacityLimit !== null) && (
        <div className="rounded-md glass-panel p-3">
          <div className="flex items-center justify-between gap-4">
            {periodType && (
              <div>
                <span className="text-xs text-slate-400">Period Type:</span>
                <span className="ml-2 text-sm font-medium text-slate-200">
                  {periodType}
                </span>
              </div>
            )}
            {capacityLimit !== null && (
              <div>
                <span className="text-xs text-slate-400">Capacity:</span>
                <span
                  className={(() => {
                    const percentage = (capacityUsed / capacityLimit) * 100;
                    if (percentage >= 100)
                      return 'ml-2 text-sm font-medium text-red-400';
                    if (percentage >= 80)
                      return 'ml-2 text-sm font-medium text-yellow-400';
                    return 'ml-2 text-sm font-medium text-green-400';
                  })()}
                >
                  {capacityUsed} / {capacityLimit} athletes
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rack list editor - map only, no title row */}
      <section className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <RackListEditor
            side={sideMode}
            snapshot={
              sideMode === 'power'
                ? (power.snapshot ?? null)
                : (base.snapshot ?? null)
            }
            date={date}
            time={time}
            viewOnly
            onEditBooking={handleEditBooking}
          />
        </div>
      </section>

      {showCreateBooking && (
        <CreateBookingFlowModal
          isOpen={showCreateBooking}
          onClose={() => setShowCreateBooking(false)}
          onSuccess={() => {
            setShowCreateBooking(false);
            invalidateSessionView();
          }}
          role={role || 'snc_coach'}
          initialDate={date}
          initialStartTime={time}
          initialEndTime={add90Minutes(time)}
          initialSide={sideKeyForModal}
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
    </div>
  );
}
