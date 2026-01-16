// src/pages/LiveView.tsx
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSnapshotFromSearchParams } from '../hooks/useSnapshotFromSearchParams';
import { Clock } from '../components/Clock';
import { RackListEditor } from '../components/schedule/RackListEditor';
import { useLiveViewCapacity } from '../components/schedule/hooks/useLiveViewCapacity';
import { isSessionInPast } from '../components/admin/booking/utils';
import { supabase } from '../lib/supabaseClient';
import {
  usePermission,
  usePrimaryOrganizationId,
} from '../hooks/usePermissions';

type SideMode = 'power' | 'base';

export function LiveView() {
  const navigate = useNavigate();
  const { date, time, power, base, update, searchParams, setSearchParams } =
    useSnapshotFromSearchParams();

  const sideParam = (searchParams.get('side') ?? 'power').toLowerCase();
  const initialSide: SideMode = sideParam === 'base' ? 'base' : 'power';

  const [sideMode, setSideMode] = useState<SideMode>(initialSide);
  const [timeInput, setTimeInput] = useState(time);

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

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle'
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 1500);
    }
  };

  // Check permissions for creating bookings
  const { organizationId: primaryOrgId } = usePrimaryOrganizationId();
  const { hasPermission: canCreateBookings } = usePermission(
    primaryOrgId,
    'bookings.create'
  );

  const handleAddBooking = () => {
    if (!canCreateBookings) {
      return;
    }

    // Calculate end time as 90 minutes after start time
    const [startHour, startMinute] = time.split(':').map(Number);
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = startTotalMinutes + 90;
    const endHour = Math.floor(endTotalMinutes / 60);
    const endMinute = endTotalMinutes % 60;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    // Navigate to bookings page with pre-filled values
    const params = new URLSearchParams({
      date,
      startTime: time,
      endTime,
      side: sideMode === 'power' ? 'Power' : 'Base',
    });
    navigate(`/bookings?${params.toString()}`);
  };

  const selectedSnapshot = sideMode === 'power' ? power : base;

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
  const isPastSession = useMemo(
    () => isSessionInPast(date, time),
    [date, time]
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header / Controls */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Session View</h1>
          <p className="text-sm text-slate-300">
            View platform allocations for a specific date and time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
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

          {/* Copy link */}
          <div className="flex flex-col">
            <span className="mb-1 text-slate-300">Share</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1 rounded-md border border-slate-600 bg-slate-950 text-xs text-slate-100 hover:bg-slate-800"
            >
              {copyState === 'copied'
                ? 'Copied'
                : copyState === 'error'
                  ? 'Error'
                  : 'Copy link'}
            </button>
          </div>

          {/* Add Booking button */}
          {canCreateBookings && (
            <div className="flex flex-col">
              <span className="mb-1 text-slate-300">Actions</span>
              <button
                type="button"
                onClick={handleAddBooking}
                className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium"
              >
                Add Booking
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Period Type and Capacity Info */}
      {(periodType || capacityLimit !== null) && (
        <div className="rounded-md bg-slate-800/50 border border-slate-700 p-3">
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

      {/* Rack list editor */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {sideMode === 'power' ? 'Power' : 'Base'} — {date} {time}
            </span>
            {isPastSession && (
              <span className="px-2 py-0.5 text-xs bg-slate-700/60 text-slate-300 rounded border border-slate-600/50 flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Locked
              </span>
            )}
          </div>
          <span className="text-slate-400">
            Snapshot at {selectedSnapshot.snapshot?.at ?? '…'}
          </span>
        </div>
        <RackListEditor
          side={sideMode}
          snapshot={
            sideMode === 'power'
              ? (power.snapshot ?? null)
              : (base.snapshot ?? null)
          }
          date={date}
          time={time}
        />
      </section>
    </div>
  );
}
