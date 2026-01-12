import { useMemo, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, getDay } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { getSideIdByKeyNode, type SideKey } from '../../nodes/data/sidesNodes';
import type { ActiveInstance } from '../../types/snapshot';
import {
  makeBaseLayout,
  makePowerLayout,
  addColumnSpacer,
  addRowSpacer,
  addDoubleColumnSpacers,
} from '../schedule/shared/layouts';
import { getGridConfig } from '../schedule/shared/gridConfig';
import { RackCell } from '../schedule/shared/RackCell';
import {
  doesScheduleApply,
  parseExcludedDates,
  type ScheduleData,
} from '../admin/capacity/scheduleUtils';

type Props = {
  /** Which side this floorplan is for */
  sideKey: 'Power' | 'Base';
  /** Selected rack numbers */
  selectedRacks: number[];
  /** Callback when a rack is clicked */
  onRackClick: (rackNumber: number, replaceSelection?: boolean) => void;
  /** Start time for checking availability (ISO string) */
  startTime: string;
  /** End time for checking availability (ISO string) */
  endTime: string;
  /** Whether to show the "Platforms" title label */
  showTitle?: boolean;
  /** If true, allows clicking on conflicting racks (for editing/selection mode) */
  allowConflictingRacks?: boolean;
  /** If true, ignores current bookings when determining availability (for capacity management) */
  ignoreBookings?: boolean;
  /** General User periods for checking platform availability during General User times */
  generalUserPeriods?: Array<{
    startTime: string;
    endTime: string;
    platforms: number[];
  }>;
  /** Instance IDs to exclude from booked racks (e.g., current booking being edited) */
  excludeInstanceIds?: Set<number>;
};

/**
 * Mini schedule-style floorplan selector for booking creation.
 * Shows a compact grid layout matching the live view, with clickable racks,
 * highlighting selected ones and graying out racks that are booked at the requested time.
 */
export function MiniScheduleFloorplan({
  sideKey,
  selectedRacks,
  onRackClick,
  startTime,
  endTime,
  showTitle = true,
  allowConflictingRacks = false,
  ignoreBookings = false,
  excludeInstanceIds,
}: Props) {
  const side = sideKey === 'Base' ? 'base' : 'power';
  const selectedSet = new Set(selectedRacks);

  // Build layout based on side
  const layout = useMemo(() => {
    if (side === 'base') {
      const withColSpacer = addColumnSpacer(makeBaseLayout());
      const withRowSpacer = addRowSpacer(withColSpacer, 3);
      return withRowSpacer;
    } else {
      const withCols = addDoubleColumnSpacers(makePowerLayout());
      const withRow = addRowSpacer(withCols, 2);
      return withRow;
    }
  }, [side]);

  // Fetch side ID
  const [sideId, setSideId] = useState<number | null>(null);
  useEffect(() => {
    getSideIdByKeyNode(sideKey as SideKey)
      .then(setSideId)
      .catch(console.error);
  }, [sideKey]);

  // Extract date and time from ISO strings
  const bookingDate = useMemo(() => {
    if (!startTime) return null;
    const date = new Date(startTime);
    return format(date, 'yyyy-MM-dd');
  }, [startTime]);

  const bookingDayOfWeek = useMemo(() => {
    if (!startTime) return null;
    return getDay(new Date(startTime));
  }, [startTime]);

  const startTimeStr = useMemo(() => {
    if (!startTime) return null;
    const date = new Date(startTime);
    return format(date, 'HH:mm');
  }, [startTime]);

  // Fetch capacity schedules to determine available platforms (only if not ignoring bookings)
  const { data: capacitySchedules = [], isLoading: capacityLoading } = useQuery(
    {
      queryKey: ['capacity-schedules-for-time', sideId, bookingDate],
      queryFn: async () => {
        if (!sideId || !bookingDate) return [];

        const dateObj = new Date(bookingDate);
        const weekStart = new Date(dateObj);
        weekStart.setDate(dateObj.getDate() - (bookingDayOfWeek ?? 0));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // Fetch all capacity schedules for this side that could apply
        const { data, error } = await supabase
          .from('capacity_schedules')
          .select('*')
          .eq('side_id', sideId)
          .lte('start_date', format(weekEnd, 'yyyy-MM-dd'))
          .or(
            `end_date.is.null,end_date.gte.${format(weekStart, 'yyyy-MM-dd')}`
          );

        if (error) {
          console.error('Error fetching capacity schedules:', error);
          return [];
        }

        return (data ?? []) as ScheduleData[];
      },
      enabled: !!sideId && !!bookingDate && !ignoreBookings,
    }
  );

  // Determine the applicable schedule first (needed for both default lookup and platform availability)
  // For a booking starting at time T, we find the schedule where T is in [schedule.start_time, schedule.end_time)
  // This means if a schedule ends at T, it does NOT apply (exclusive end)
  // And if a schedule starts at T, it DOES apply (inclusive start)
  const applicableSchedule = useMemo(() => {
    if (
      !capacitySchedules.length ||
      !startTimeStr ||
      bookingDayOfWeek === null ||
      !bookingDate
    ) {
      return null;
    }

    // Filter schedules that could apply based on time range and day matching
    // We want the schedule that applies at the booking start time
    const potentiallyApplicable = capacitySchedules.filter((schedule) => {
      const scheduleData: ScheduleData = {
        ...schedule,
        excluded_dates: parseExcludedDates(schedule.excluded_dates),
      };
      return doesScheduleApply(
        scheduleData,
        bookingDayOfWeek,
        bookingDate,
        startTimeStr
      );
    });

    // If multiple schedules apply (shouldn't happen with proper validation, but handle it)
    // Prefer non-Closed schedules, then prefer the one that starts closest to the booking time
    if (potentiallyApplicable.length > 1) {
      // Sort: non-Closed first, then by start_time (latest first, so we get the most recent period)
      potentiallyApplicable.sort((a, b) => {
        if (a.period_type === 'Closed' && b.period_type !== 'Closed') return 1;
        if (a.period_type !== 'Closed' && b.period_type === 'Closed') return -1;
        // Both same type, prefer later start time (more specific)
        return b.start_time.localeCompare(a.start_time);
      });
    }

    return potentiallyApplicable[0] || null;
  }, [capacitySchedules, startTimeStr, bookingDayOfWeek, bookingDate]);

  // Fetch default platforms for the applicable schedule's period type (if needed)
  const { data: defaultPlatforms } = useQuery({
    queryKey: ['default-platforms', sideId, applicableSchedule?.period_type],
    queryFn: async () => {
      if (!sideId || !applicableSchedule) {
        return null;
      }

      // If schedule has platforms explicitly set (even if empty array), don't check defaults
      if (
        applicableSchedule.platforms !== null &&
        applicableSchedule.platforms !== undefined
      ) {
        return null; // Schedule has explicit platforms, no need for defaults
      }

      // Schedule doesn't have platforms set, check defaults
      const { data, error } = await supabase
        .from('period_type_capacity_defaults')
        .select('platforms')
        .eq('period_type', applicableSchedule.period_type)
        .eq('side_id', sideId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching default platforms:', error);
        return null;
      }

      // If defaults exist, return them; otherwise return empty array (no platforms available)
      if (data?.platforms && Array.isArray(data.platforms)) {
        return data.platforms as number[];
      }

      return []; // No defaults set, no platforms available
    },
    enabled: !!sideId && !!applicableSchedule && !ignoreBookings,
  });

  // Determine which capacity schedule applies and get available platforms
  // If ignoreBookings is true (capacity management), don't check capacity schedules - all platforms are available
  // This works for ALL period types including General User - they're all in the capacitySchedules query
  const availablePlatforms = useMemo(() => {
    if (ignoreBookings) {
      return null; // null means all platforms are available (no restriction)
    }

    if (!applicableSchedule) {
      return null; // No schedule applies, all platforms available
    }

    // Get platforms from the schedule
    // If platforms is explicitly set (even if empty array []), use it directly
    // If platforms is null/undefined, check defaults
    if (
      applicableSchedule.platforms !== null &&
      applicableSchedule.platforms !== undefined
    ) {
      // Platforms are explicitly set in the schedule (could be empty array for 0 platforms)
      const platforms = Array.isArray(applicableSchedule.platforms)
        ? (applicableSchedule.platforms as number[])
        : [];
      return new Set(platforms); // Empty Set if platforms.length === 0 (no platforms available)
    }

    // Schedule doesn't have platforms set, use defaults if available
    if (defaultPlatforms !== null && defaultPlatforms !== undefined) {
      return new Set(defaultPlatforms); // Empty Set if defaultPlatforms.length === 0 (no platforms available)
    }

    // No defaults set - if schedule doesn't restrict platforms, treat as all available (null)
    // This handles the case where a schedule exists but hasn't configured platforms yet
    // Only return empty Set if we're explicitly told there are 0 platforms
    return null;
  }, [applicableSchedule, ignoreBookings, defaultPlatforms]);

  // Determine if the applicable schedule is General User (for warning message)
  const isGeneralUserPeriod = useMemo(() => {
    if (ignoreBookings || !applicableSchedule) {
      return false;
    }
    return applicableSchedule.period_type === 'General User';
  }, [applicableSchedule, ignoreBookings]);

  // Fetch booking instances that overlap with the requested time (only if not ignoring bookings)
  const { data: instances = [], isLoading: instancesLoading } = useQuery({
    queryKey: ['booking-instances-for-time', sideId, startTime, endTime],
    queryFn: async () => {
      if (!sideId) return [];

      // Fetch instances that overlap with the requested time range
      const { data, error } = await supabase
        .from('booking_instances')
        .select(
          `
          id,
          booking_id,
          side_id,
          start,
          "end",
          areas,
          racks,
          booking:bookings (
            title,
            color,
            is_locked,
            created_by
          )
        `
        )
        .eq('side_id', sideId)
        .lt('start', endTime) // instance starts before our end time
        .gt('end', startTime) // instance ends after our start time
        .order('start', { ascending: true });

      if (error) {
        console.error('Error fetching instances:', error);
        return [];
      }

      // Normalize the data to match ActiveInstance format
      return (data ?? []).map((row: unknown) => {
        const r = row as {
          id: number;
          booking_id: number;
          start: string;
          end: string;
          racks: number[] | unknown;
          areas: string[] | unknown;
          booking?: {
            title?: string;
            color?: string;
            is_locked?: boolean;
            created_by?: string;
          } | null;
        };
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
        };
      }) as ActiveInstance[];
    },
    enabled: !!sideId && !!startTime && !!endTime && !ignoreBookings,
  });

  const isLoading = capacityLoading || instancesLoading;

  // Build a map of which racks are used by other bookings (empty if ignoring bookings)
  // Exclude racks that belong to the current booking being edited
  const bookedRacks = useMemo(() => {
    if (ignoreBookings) {
      return new Set<number>();
    }
    const booked = new Set<number>();
    for (const inst of instances) {
      // Skip instances that should be excluded (e.g., current booking being edited)
      if (excludeInstanceIds && excludeInstanceIds.has(inst.instanceId)) {
        continue;
      }
      for (const rack of inst.racks) {
        booked.add(rack);
      }
    }
    return booked;
  }, [instances, ignoreBookings, excludeInstanceIds]);

  // Build a set of selected racks that have conflicts (are booked by others OR not available in schedule)
  // If ignoreBookings is true, no conflicts should be detected
  const conflictingSelectedRacks = useMemo(() => {
    if (ignoreBookings) {
      return new Set<number>();
    }
    const conflicting = new Set<number>();
    for (const rack of selectedRacks) {
      // Conflict if booked by another booking
      if (bookedRacks.has(rack)) {
        conflicting.add(rack);
      }
      // Conflict if not available in capacity schedule (when schedule restricts platforms)
      if (availablePlatforms !== null && !availablePlatforms.has(rack)) {
        conflicting.add(rack);
      }
    }
    return conflicting;
  }, [selectedRacks, bookedRacks, availablePlatforms, ignoreBookings]);

  // Build a map of current instance by rack (excluding current booking being edited)
  const bookingByRack = useMemo(() => {
    const map = new Map<number, ActiveInstance>();
    for (const inst of instances) {
      // Skip instances that should be excluded (e.g., current booking being edited)
      if (excludeInstanceIds && excludeInstanceIds.has(inst.instanceId)) {
        continue;
      }
      for (const rack of inst.racks) {
        map.set(rack, inst);
      }
    }
    return map;
  }, [instances, excludeInstanceIds]);

  // Grid configuration - compact version (using shared config with custom row heights)
  const baseGridConfig = getGridConfig(side);
  const gridConfig = useMemo(() => {
    if (side === 'base') {
      return {
        ...baseGridConfig,
        // Use fixed small row heights instead of 1fr, with walkway spacer (row 4)
        gridTemplateRows: 'auto auto auto 0.2fr auto auto auto',
      };
    } else {
      return {
        ...baseGridConfig,
        // Use fixed small row heights instead of 1fr, with walkway spacer (row 3)
        gridTemplateRows: 'auto auto 0.2fr auto auto auto',
      };
    }
  }, [side, baseGridConfig]);

  return (
    <div className="w-full">
      {showTitle && (
        <label className="block mb-1 font-medium text-xs">Platforms</label>
      )}
      <div className="border border-slate-700 rounded-md bg-slate-950/60 p-1.5">
        <div className="w-full">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridConfig.gridTemplateColumns,
              gridTemplateRows: gridConfig.gridTemplateRows,
              columnGap: '4px',
              rowGap: '4px',
              padding: '6px',
            }}
          >
            {gridConfig.showBanner && (
              <div
                style={{
                  gridColumn: 3,
                  gridRow: gridConfig.bannerRowSpan,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  color: 'rgba(148, 163, 184, 0.8)',
                  fontWeight: 600,
                }}
              >
                WHERE HISTORY BEGINS
              </div>
            )}
            {layout.map((row) => {
              const booking =
                row.rackNumber !== null && !ignoreBookings
                  ? (bookingByRack.get(row.rackNumber) ?? null)
                  : null;
              const isUsedByOtherBooking =
                !ignoreBookings &&
                row.rackNumber !== null &&
                bookedRacks.has(row.rackNumber);
              // Check if platform is available in capacity schedule
              // If ignoreBookings is true (capacity management), don't check capacity schedules - all platforms are available
              const isAvailableInSchedule = ignoreBookings
                ? true
                : row.rackNumber === null ||
                  availablePlatforms === null ||
                  availablePlatforms.has(row.rackNumber);
              // Platform is unavailable if it's booked OR not in the capacity schedule
              // For capacity management (ignoreBookings), platforms are never unavailable - we can select any platform
              const isUnavailable = ignoreBookings
                ? false
                : row.rackNumber !== null &&
                  (!isAvailableInSchedule || isUsedByOtherBooking);
              // Determine why it's unavailable for display purposes
              const unavailableReason =
                row.rackNumber !== null && isUnavailable && !ignoreBookings
                  ? isUsedByOtherBooking
                    ? 'booked'
                    : !isAvailableInSchedule
                      ? 'not-in-schedule'
                      : null
                  : null;
              const isSelected =
                row.rackNumber !== null && selectedSet.has(row.rackNumber);
              // A selected rack has a conflict if it's both selected and unavailable
              // If ignoreBookings is true, no conflicts should be shown
              const hasConflict = ignoreBookings
                ? false
                : row.rackNumber !== null &&
                  isSelected &&
                  (conflictingSelectedRacks.has(row.rackNumber) ||
                    !isAvailableInSchedule);
              // Conflicting racks are NOT clickable - only available racks can be clicked
              // If there are conflicts in the selection and clicking an available rack, it will clear the week
              // Selected racks are always clickable so they can be unselected, even if marked as unavailable
              const isClickable =
                row.rackNumber !== null &&
                !row.disabled &&
                (isSelected || allowConflictingRacks || !isUnavailable);

              return (
                <RackCell
                  key={row.id}
                  row={row}
                  booking={booking}
                  isSelected={isSelected}
                  isDisabled={isUnavailable}
                  isClickable={isClickable}
                  hasConflict={hasConflict}
                  unavailableReason={unavailableReason}
                  onClick={() => {
                    if (isClickable && row.rackNumber !== null) {
                      // If there are conflicts in the current week's selection and clicking an available rack,
                      // replace the entire selection with just this rack
                      const weekHasConflicts =
                        conflictingSelectedRacks.size > 0;
                      if (weekHasConflicts) {
                        // When there are conflicts, clicking an available rack should replace the entire selection
                        onRackClick(row.rackNumber, true);
                      } else {
                        // Normal selection behavior when no conflicts
                        onRackClick(row.rackNumber, false);
                      }
                    }
                  }}
                  variant="mini"
                />
              );
            })}
          </div>
        </div>
        {isLoading && (
          <p className="text-xs text-slate-400 mt-1 text-center">
            Checking availability...
          </p>
        )}
        {!isLoading &&
          isGeneralUserPeriod &&
          availablePlatforms !== null &&
          !ignoreBookings && (
            <div className="mt-2 p-2 bg-amber-900/20 border border-amber-700 rounded-md">
              <p className="text-xs text-amber-400 text-center">
                ⚠️ This booking overlaps with General User periods. Only
                platforms available during these times can be selected.
              </p>
            </div>
          )}
        {selectedRacks.length > 0 && (
          <p className="text-xs text-slate-300 mt-1 text-center">
            {selectedRacks.length} rack{selectedRacks.length !== 1 ? 's' : ''}{' '}
            selected
          </p>
        )}
      </div>
    </div>
  );
}
