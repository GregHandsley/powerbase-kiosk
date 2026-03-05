import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragEndEvent,
} from '@dnd-kit/core';
import { supabase } from '../../lib/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { createTasksForUsers, getUserIdsByRole } from '../../hooks/useTasks';
import { isSessionInPast } from '../admin/booking/utils';
import type { SideSnapshot } from '../../types/snapshot';
import type { ActiveInstance } from '../../types/snapshot';
import type { BookingStatus } from '../../types/db';
import { RackEditorHeader } from './rack-editor/RackEditorHeader';
import { RackEditorGrid } from './rack-editor/RackEditorGrid';
import { RackEditorDragOverlay } from './rack-editor/RackEditorDragOverlay';
import { BookingEditorModal } from './BookingEditorModal';
import { SessionBookingInfoModal } from './SessionBookingInfoModal';
import { useRackEditorDimensions } from './rack-editor/hooks/useRackEditorDimensions';
import { useRackAssignments } from './rack-editor/hooks/useRackAssignments';
import { useDragSensors } from './rack-editor/hooks/useDragSensors';
import { useDragHandlers } from './rack-editor/hooks/useDragHandlers';
import { RackSelectionPanel } from './rack-editor/RackSelectionPanel';
import { UpdateRacksConfirmationDialog } from './booking-editor/dialogs/UpdateRacksConfirmationDialog';
import { useLiveViewCapacity } from './hooks/useLiveViewCapacity';
import { MiniAreasFloorplan } from '../shared/MiniAreasFloorplan';
import { saveAreaSlotsForInstance } from '../../nodes/data/areaSlotsNodes';

export type RackRow = {
  id: string; // rack-<number> or platform-<number>
  label: string;
  rackNumber: number | null; // null for non-bookable
  disabled?: boolean;
  /** True for open platforms without a rack (e.g. Power Platform 1 & 2) */
  isOpenPlatform?: boolean;
  gridColumn: number;
  gridRow: number;
};

export type RackListEditorCoreProps = {
  snapshot: SideSnapshot | null;
  layout: RackRow[];
  bannerRowSpan?: string;
  beforeRacks?: ReactNode;
  showBanner?: boolean;
  gridTemplateColumns?: string;
  /** Number of content rows in the grid (excluding spacer rows that use minmax) */
  numRows?: number;
  /** Which row index is a spacer (walkway) - uses smaller height */
  spacerRow?: number;
  /** Side mode for the floorplan */
  side: 'power' | 'base';
  /** Date for checking capacity schedules (YYYY-MM-DD) */
  date: string;
  /** Time for checking capacity schedules (HH:mm) */
  time: string;
  /** When true, clicking a booking shows read-only info modal instead of opening the editor. */
  viewOnly?: boolean;
  /** When viewOnly and provided, clicking a booking calls this instead of opening the read-only modal (e.g. Session View edit). */
  onEditBooking?: (booking: ActiveInstance) => void;
};

export function RackListEditorCore({
  snapshot,
  layout,
  bannerRowSpan = '1 / span 6',
  beforeRacks,
  showBanner = false,
  gridTemplateColumns = 'repeat(2, 1fr) 0.3fr repeat(2, 1fr)',
  numRows = 6,
  spacerRow,
  side,
  date,
  time,
  viewOnly = false,
  onEditBooking,
}: RackListEditorCoreProps) {
  const bookings = useMemo(() => snapshot?.currentInstances ?? [], [snapshot]);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Capacity / availability state for the live view
  const { availablePlatforms, isClosedPeriod } = useLiveViewCapacity({
    side,
    date,
    time,
  });

  const [editingBooking, setEditingBooking] = useState<ActiveInstance | null>(
    null
  );
  const [viewingBooking, setViewingBooking] = useState<ActiveInstance | null>(
    null
  );
  const [isSelectingRacks, setIsSelectingRacks] = useState(false);
  const [selectedRacks, setSelectedRacks] = useState<number[]>([]);
  const [savingRacks, setSavingRacks] = useState(false);
  const [selectedInstancesForRacks, setSelectedInstancesForRacks] = useState<
    Set<number>
  >(new Set());
  const [applyRacksToAll, setApplyRacksToAll] = useState(false);
  const [rackValidationError, setRackValidationError] = useState<string | null>(
    null
  );
  const [savedSelectedInstances, setSavedSelectedInstances] = useState<
    Set<number>
  >(new Set());
  const [showUpdateRacksConfirm, setShowUpdateRacksConfirm] = useState(false);
  const [rackSelectionWeekIndex, setRackSelectionWeekIndex] = useState(0);
  const [liveViewMode, setLiveViewMode] = useState<'areas' | 'platforms'>(
    'areas'
  );
  const [areaAssignments, setAreaAssignments] = useState<Map<number, string[]>>(
    new Map()
  );
  const [initialAreaAssignments, setInitialAreaAssignments] = useState<
    Map<number, string[]>
  >(new Map());
  const [areaSaving, setAreaSaving] = useState(false);
  const [areaSavedAt, setAreaSavedAt] = useState<Date | null>(null);
  const [areaDragError, setAreaDragError] = useState<string | null>(null);
  const hasInitializedRacks = useRef(false);
  const isEnteringSelectionMode = useRef(false);
  const hasSelectionsFromModal = useRef(false);

  const handleEditBooking = (booking: ActiveInstance) => {
    setEditingBooking(booking);
  };

  const handleViewBooking = (booking: ActiveInstance) => {
    setViewingBooking(booking);
  };

  const onBookingClickWhenViewOnly =
    viewOnly && onEditBooking ? onEditBooking : handleViewBooking;

  const handleCloseModal = () => {
    // Only clear editingBooking if we're not entering selection mode
    // Use a ref to track when we're about to enter selection mode
    if (!isSelectingRacks && !isEnteringSelectionMode.current) {
      setEditingBooking(null);
    } else {
      isEnteringSelectionMode.current = false; // Reset the flag
    }
  };

  const handleEditRacks = (selectedInstancesFromModal?: Set<number>) => {
    if (editingBooking) {
      const initialRacks = [...editingBooking.racks];
      // Save selected instances from modal for later restoration
      if (selectedInstancesFromModal && selectedInstancesFromModal.size > 0) {
        setSavedSelectedInstances(new Set(selectedInstancesFromModal));
      }
      // Set flag to prevent handleCloseModal from clearing editingBooking
      isEnteringSelectionMode.current = true;
      // Set selection mode - modal will close automatically
      setIsSelectingRacks(true);
      setSelectedRacks(initialRacks);
      // Use selected instances from modal if provided, otherwise default to current instance
      if (selectedInstancesFromModal && selectedInstancesFromModal.size > 0) {
        setSelectedInstancesForRacks(selectedInstancesFromModal);
        hasSelectionsFromModal.current = true; // Mark that we have selections from modal
        // Don't set applyRacksToAll here - it will be calculated when seriesInstancesForRacks loads
      } else {
        // Initially select only the current instance
        setSelectedInstancesForRacks(new Set([editingBooking.instanceId]));
        setApplyRacksToAll(false);
        hasSelectionsFromModal.current = false;
      }
      hasInitializedRacks.current = false; // Reset initialization flag
      // Don't clear editingBooking - we need it for the selection mode
    }
  };

  const handleSaveTime = async (startTime: string, endTime: string) => {
    if (!editingBooking) return;

    const { error } = await supabase
      .from('booking_instances')
      .update({
        start: startTime,
        end: endTime,
      })
      .eq('id', editingBooking.instanceId);

    if (error) {
      throw new Error(error.message);
    }

    await queryClient.invalidateQueries({
      queryKey: ['snapshot'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-instances-debug'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-instances-for-time'],
      exact: false,
    });
  };

  const handleCancelRackSelection = () => {
    setIsSelectingRacks(false);
    setRackValidationError(null);
    if (editingBooking) {
      setSelectedRacks([...editingBooking.racks]);
    }
    // Don't clear savedSelectedInstances - we'll use them when modal reopens
  };

  // Validate racks for conflicts before saving
  const validateRacksForInstances = async (): Promise<string | null> => {
    if (
      !editingBooking ||
      selectedRacks.length === 0 ||
      selectedInstancesForRacks.size === 0
    ) {
      return null;
    }

    // Get the selected instances with their time ranges
    const instancesToCheck = seriesInstancesForRacks.filter((inst) =>
      selectedInstancesForRacks.has(inst.id)
    );

    if (instancesToCheck.length === 0) {
      return null;
    }

    // Get the side_id from the first instance or from snapshot
    const sideId = instancesToCheck[0]?.sideId ?? snapshot?.sideId;

    if (!sideId) {
      return 'Unable to determine side for validation. Please try again.';
    }

    // Check each instance for conflicts
    const conflicts: Array<{
      instanceId: number;
      instanceTime: string;
      rack: number;
      conflictingBooking: string;
    }> = [];

    for (const instance of instancesToCheck) {
      // Fetch all booking instances that overlap with this instance's time range
      // and use any of the selected racks
      const { data: overlappingInstances, error } = await supabase
        .from('booking_instances')
        .select(
          `
          id,
          booking_id,
          start,
          "end",
          racks,
          booking:bookings (
            title
          )
        `
        )
        .eq('side_id', sideId)
        .lt('start', instance.end) // instance starts before our end time
        .gt('end', instance.start) // instance ends after our start time
        .neq('booking_id', editingBooking.bookingId); // Exclude instances from the same booking

      if (error) {
        console.error('Error checking for conflicts:', error);
        return `Error checking for conflicts: ${error.message}`;
      }

      // Check each selected rack for conflicts
      for (const rack of selectedRacks) {
        const conflictingInstance = overlappingInstances?.find((inst) => {
          const instRacks = Array.isArray(inst.racks) ? inst.racks : [];
          return instRacks.includes(rack);
        });

        if (conflictingInstance) {
          const formatDateTime = (isoString: string) => {
            const date = new Date(isoString);
            return date.toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          };

          conflicts.push({
            instanceId: instance.id,
            instanceTime: `${formatDateTime(instance.start)} - ${formatDateTime(instance.end)}`,
            rack,
            conflictingBooking:
              (conflictingInstance.booking as { title?: string })?.title ??
              'Unknown',
          });
        }
      }
    }

    if (conflicts.length > 0) {
      // Group conflicts by instance for better error message
      const conflictsByInstance = new Map<
        number,
        Array<{ rack: number; conflictingBooking: string }>
      >();
      conflicts.forEach((conflict) => {
        if (!conflictsByInstance.has(conflict.instanceId)) {
          conflictsByInstance.set(conflict.instanceId, []);
        }
        conflictsByInstance.get(conflict.instanceId)!.push({
          rack: conflict.rack,
          conflictingBooking: conflict.conflictingBooking,
        });
      });

      let errorMessage = 'Rack conflicts detected:\n\n';
      conflictsByInstance.forEach((rackConflicts, instanceId) => {
        const instance = instancesToCheck.find(
          (inst) => inst.id === instanceId
        );
        const timeStr = instance
          ? `${new Date(instance.start).toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })} - ${new Date(instance.end).toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : 'Unknown time';
        errorMessage += `Session: ${timeStr}\n`;
        rackConflicts.forEach(({ rack, conflictingBooking }) => {
          errorMessage += `  • Rack ${rack} is booked by "${conflictingBooking}"\n`;
        });
        errorMessage += '\n';
      });

      return errorMessage.trim();
    }

    return null;
  };

  const handleSaveRacks = async () => {
    if (!editingBooking || selectedRacks.length === 0) return;

    if (selectedInstancesForRacks.size === 0) {
      setRackValidationError('Please select at least one session to update');
      return;
    }

    // Clear any previous validation errors
    setRackValidationError(null);

    // Validate for conflicts
    const validationError = await validateRacksForInstances();
    if (validationError) {
      setRackValidationError(validationError);
      return;
    }

    // Show confirmation if updating multiple instances
    if (selectedInstancesForRacks.size > 1) {
      setShowUpdateRacksConfirm(true);
      return; // Wait for confirmation
    }

    // If only one session, proceed directly
    await performRackUpdate();
  };

  const performRackUpdate = async () => {
    if (!editingBooking || selectedRacks.length === 0) return;

    setSavingRacks(true);
    try {
      // Update all selected instances
      const instanceIds = Array.from(selectedInstancesForRacks);
      const updates = instanceIds.map(async (instanceId) => {
        const { error } = await supabase
          .from('booking_instances')
          .update({ racks: selectedRacks })
          .eq('id', instanceId);

        if (error) {
          throw new Error(error.message);
        }
      });

      await Promise.all(updates);

      // Update the booking record to mark it as edited and reset status if it was processed
      // This ensures the bookings team sees the change and can reprocess it
      if (editingBooking.bookingId && user?.id) {
        const { data: currentBooking } = await supabase
          .from('bookings')
          .select('status, title')
          .eq('id', editingBooking.bookingId)
          .maybeSingle();

        if (currentBooking) {
          const updateData: {
            last_edited_at: string;
            last_edited_by: string;
            status?: BookingStatus;
          } = {
            last_edited_at: new Date().toISOString(),
            last_edited_by: user.id,
          };

          // If booking was processed, reset to pending so bookings team can review the rack changes
          if (currentBooking.status === 'processed') {
            updateData.status = 'pending';
          }

          await supabase
            .from('bookings')
            .update(updateData)
            .eq('id', editingBooking.bookingId);

          // Create tasks for bookings team if booking was processed or if it's a change
          if (
            currentBooking.status === 'processed' ||
            updateData.status === 'pending'
          ) {
            try {
              const bookingsTeamIds = await getUserIdsByRole('bookings_team');
              const adminIds = await getUserIdsByRole('admin');
              const allNotifyIds = [
                ...new Set([...bookingsTeamIds, ...adminIds]),
              ];

              if (allNotifyIds.length > 0) {
                await createTasksForUsers(allNotifyIds, {
                  type: 'booking:edited',
                  title:
                    currentBooking.status === 'processed'
                      ? 'Processed Booking Edited'
                      : 'Booking Edited',
                  message:
                    currentBooking.status === 'processed'
                      ? `Processed booking "${currentBooking.title || 'Untitled'}" had racks/platforms changed and needs reprocessing.`
                      : `Booking "${currentBooking.title || 'Untitled'}" had racks/platforms changed.`,
                  link: `/bookings-team?booking=${editingBooking.bookingId}`,
                  metadata: {
                    booking_id: editingBooking.bookingId,
                    booking_title: currentBooking.title || null,
                    changed_by: user.id,
                    was_processed: currentBooking.status === 'processed',
                  },
                });
              }
            } catch (taskError) {
              console.error('Failed to create tasks:', taskError);
              // Don't fail the save if tasks fail
            }
          }
        }
      }

      await queryClient.invalidateQueries({
        queryKey: ['snapshot'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['booking-instances-debug'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['booking-instances-for-time'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['booking-series'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['booking-series-racks'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['bookings-team'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['my-bookings'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['tasks'],
        exact: false,
      });

      setIsSelectingRacks(false);
      setEditingBooking(null);
      setRackValidationError(null);
      setShowUpdateRacksConfirm(false);
    } catch (err) {
      console.error('Failed to save racks', err);
      setRackValidationError(
        err instanceof Error ? err.message : 'Failed to save racks'
      );
    } finally {
      setSavingRacks(false);
    }
  };

  const handleRackClick = (rackNumber: number) => {
    if (!editingBooking || !isSelectingRacks) {
      return;
    }

    // Check if rack is used by another booking (use bookingsForDisplay which includes week-specific bookings)
    const rackUsedByOther = bookingsForDisplay.some(
      (b) =>
        b.instanceId !== editingBooking.instanceId &&
        b.racks.includes(rackNumber)
    );
    if (rackUsedByOther) {
      return; // Can't select racks used by others
    }

    setSelectedRacks((prev) => {
      const newRacks = prev.includes(rackNumber)
        ? prev.filter((n) => n !== rackNumber).sort((a, b) => a - b)
        : [...prev, rackNumber].sort((a, b) => a - b);
      // Clear validation error when racks change
      setRackValidationError(null);
      return newRacks;
    });
  };

  // Fetch all instances in the series for rack selection
  const { data: seriesInstancesForRacks = [] } = useQuery({
    queryKey: ['booking-series-racks', editingBooking?.bookingId],
    queryFn: async () => {
      if (!editingBooking) return [];

      const { data, error } = await supabase
        .from('booking_instances')
        .select('id, start, end, side_id')
        .eq('booking_id', editingBooking.bookingId)
        .order('start', { ascending: true });

      if (error) {
        console.error('Error fetching series instances for racks:', error);
        return [];
      }

      return (data ?? []).map((inst) => ({
        id: inst.id,
        start: inst.start,
        end: inst.end,
        sideId: inst.side_id,
      }));
    },
    enabled: !!editingBooking && isSelectingRacks,
  });

  // Group instances by week for navigation
  const instancesByWeekForRacks = useMemo(() => {
    const weekMap = new Map<number, typeof seriesInstancesForRacks>();
    seriesInstancesForRacks.forEach((inst) => {
      const startDate = new Date(inst.start);
      // Get the start of the week (Monday)
      const weekStart = new Date(startDate);
      const dayOfWeek = startDate.getDay();
      const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.getTime();

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(inst);
    });
    return weekMap;
  }, [seriesInstancesForRacks]);

  const weeksForRacks = useMemo(
    () => Array.from(instancesByWeekForRacks.keys()).sort((a, b) => a - b),
    [instancesByWeekForRacks]
  );

  const currentWeekForRacks = useMemo(
    () => weeksForRacks[rackSelectionWeekIndex] ?? weeksForRacks[0] ?? null,
    [weeksForRacks, rackSelectionWeekIndex]
  );

  const currentWeekInstancesForRacks = useMemo(
    () =>
      currentWeekForRacks
        ? (instancesByWeekForRacks.get(currentWeekForRacks) ?? [])
        : [],
    [currentWeekForRacks, instancesByWeekForRacks]
  );

  // Calculate time range for current week to fetch overlapping bookings
  const currentWeekTimeRange = useMemo(() => {
    if (currentWeekInstancesForRacks.length === 0) return null;
    const starts = currentWeekInstancesForRacks.map((inst) =>
      new Date(inst.start).getTime()
    );
    const ends = currentWeekInstancesForRacks.map((inst) =>
      new Date(inst.end).getTime()
    );
    return {
      start: new Date(Math.min(...starts)).toISOString(),
      end: new Date(Math.max(...ends)).toISOString(),
    };
  }, [currentWeekInstancesForRacks]);

  // Fetch bookings that overlap with the current week's time range
  const { data: bookingsForCurrentWeek = [] } = useQuery({
    queryKey: [
      'booking-instances-for-rack-selection',
      snapshot?.sideId,
      currentWeekTimeRange?.start,
      currentWeekTimeRange?.end,
    ],
    queryFn: async () => {
      if (!snapshot?.sideId || !currentWeekTimeRange) return [];

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
          booking:bookings (
            title,
            color,
            is_locked,
            created_by,
            status
          )
        `
        )
        .eq('side_id', snapshot.sideId)
        .lt('start', currentWeekTimeRange.end)
        .gt('end', currentWeekTimeRange.start)
        .order('start', { ascending: true });

      if (error) {
        console.error('Error fetching bookings for week:', error);
        return [];
      }

      // Filter out cancelled bookings (but keep pending_cancellation until confirmed)
      // Supabase doesn't support filtering on joined table fields
      const validBookings = (data ?? []).filter((row: unknown) => {
        const r = row as {
          booking?: { status?: string } | null;
        };
        const status = r.booking?.status;
        // Only exclude fully cancelled bookings
        // pending_cancellation bookings should still appear and block capacity until confirmed
        // If status is undefined/null, include it (backward compatibility)
        if (!status) return true;
        return status !== 'cancelled';
      });

      // Normalize to ActiveInstance format
      return validBookings.map((row: unknown) => {
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
            status?: string;
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
    enabled: !!snapshot?.sideId && !!currentWeekTimeRange && isSelectingRacks,
  });

  // Initialize selected racks when entering selection mode (only on initial entry)
  useEffect(() => {
    if (isSelectingRacks && editingBooking && !hasInitializedRacks.current) {
      setSelectedRacks([...editingBooking.racks]);
      // selectedInstancesForRacks should already be set by handleEditRacks
      // Only set default if it's still empty (wasn't set by handleEditRacks)
      if (selectedInstancesForRacks.size === 0) {
        setSelectedInstancesForRacks(new Set([editingBooking.instanceId]));
      }
      setApplyRacksToAll(false);
      setRackSelectionWeekIndex(0); // Reset to first week
      hasInitializedRacks.current = true;
    } else if (!isSelectingRacks) {
      // Reset the flag when exiting selection mode
      hasInitializedRacks.current = false;
      hasSelectionsFromModal.current = false;
      setSelectedInstancesForRacks(new Set());
      setApplyRacksToAll(false);
      setRackSelectionWeekIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectingRacks, editingBooking]);

  // Update selected instances when applyRacksToAll changes or when seriesInstancesForRacks loads
  useEffect(() => {
    if (!editingBooking || seriesInstancesForRacks.length === 0) return;

    // If we have selections from modal, don't override them - just sync applyRacksToAll
    if (hasSelectionsFromModal.current) {
      const allSelected =
        selectedInstancesForRacks.size === seriesInstancesForRacks.length;
      if (allSelected !== applyRacksToAll) {
        setApplyRacksToAll(allSelected);
      }
      // Clear the flag after first sync
      hasSelectionsFromModal.current = false;
      return;
    }

    if (applyRacksToAll) {
      setSelectedInstancesForRacks(
        new Set(seriesInstancesForRacks.map((inst) => inst.id))
      );
    } else {
      // Only update if we have a minimal selection (0 or just current instance)
      const hasOnlyCurrentInstance =
        selectedInstancesForRacks.size === 1 &&
        selectedInstancesForRacks.has(editingBooking.instanceId);
      if (selectedInstancesForRacks.size === 0 || hasOnlyCurrentInstance) {
        setSelectedInstancesForRacks(new Set([editingBooking.instanceId]));
      }
    }
  }, [
    applyRacksToAll,
    editingBooking,
    seriesInstancesForRacks,
    selectedInstancesForRacks,
  ]);

  const {
    containerRef,
    BASE_WIDTH,
    BASE_HEIGHT,
    zoomLevel,
    renderedHeight,
    renderedWidth,
  } = useRackEditorDimensions();

  const sensors = useDragSensors();

  // Check if the session is in the past - if so, disable all dragging
  const isPastSession = useMemo(
    () => isSessionInPast(date, time),
    [date, time]
  );

  useEffect(() => {
    setLiveViewMode('areas');
  }, [side, date, time]);

  useEffect(() => {
    if (isSelectingRacks) {
      setLiveViewMode('platforms');
    }
  }, [isSelectingRacks]);

  // Use week-specific bookings when in rack selection mode, otherwise use snapshot bookings
  const bookingsForDisplay = useMemo(() => {
    if (isSelectingRacks && bookingsForCurrentWeek.length > 0) {
      return bookingsForCurrentWeek;
    }
    return bookings;
  }, [isSelectingRacks, bookingsForCurrentWeek, bookings]);

  const getBookingAreaKeys = (booking: ActiveInstance): string[] => {
    const keys = new Set<string>(booking.areas ?? []);
    (booking.area_slots ?? []).forEach((slot) => {
      if (!slot.area_key.startsWith('rack_')) {
        keys.add(slot.area_key);
      }
    });
    return Array.from(keys);
  };

  useEffect(() => {
    const next = new Map<number, string[]>();
    bookingsForDisplay.forEach((booking) => {
      next.set(booking.instanceId, getBookingAreaKeys(booking));
    });
    setAreaAssignments(next);
    setInitialAreaAssignments(new Map(next));
    setAreaSavedAt(null);
  }, [bookingsForDisplay]);

  const areaBookingByKey = useMemo(() => {
    const map = new Map<string, ActiveInstance>();
    const sortedBookings = [...bookingsForDisplay].sort((a, b) =>
      a.start.localeCompare(b.start)
    );
    for (const booking of sortedBookings) {
      const areaKeys = areaAssignments.get(booking.instanceId) ?? [];
      for (const areaKey of areaKeys) {
        if (!map.has(areaKey)) {
          map.set(areaKey, booking);
        }
      }
    }
    return map;
  }, [bookingsForDisplay, areaAssignments]);

  const highlightedAreas = useMemo(
    () => Array.from(areaBookingByKey.keys()),
    [areaBookingByKey]
  );

  const handleAreaDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const booking = active.data.current?.booking as ActiveInstance | undefined;
    const fromAreaKey = active.data.current?.fromAreaKey as string | undefined;
    const toAreaKey = over.data.current?.areaKey as string | undefined;
    if (!booking || !fromAreaKey || !toAreaKey) return;
    if (fromAreaKey === toAreaKey) return;

    const occupied = areaBookingByKey.get(toAreaKey);
    if (occupied && occupied.instanceId !== booking.instanceId) {
      setAreaDragError('Target area is already occupied at this time.');
      setTimeout(() => setAreaDragError(null), 3000);
      return;
    }

    setAreaDragError(null);
    setAreaAssignments((prev) => {
      const current = prev.get(booking.instanceId) ?? [];
      if (!current.includes(fromAreaKey)) return prev;
      const replaced = current.map((key) =>
        key === fromAreaKey ? toAreaKey : key
      );
      const deduped = Array.from(new Set(replaced));
      const next = new Map(prev);
      next.set(booking.instanceId, deduped);
      return next;
    });
  };

  const handleSaveAreaAssignments = async () => {
    setAreaSaving(true);
    try {
      const changed: Array<{
        instanceId: number;
        oldAreas: string[];
        newAreas: string[];
        booking: ActiveInstance;
      }> = [];

      bookingsForDisplay.forEach((booking) => {
        const oldAreas = initialAreaAssignments.get(booking.instanceId) ?? [];
        const newAreas = areaAssignments.get(booking.instanceId) ?? oldAreas;
        const same =
          oldAreas.length === newAreas.length &&
          oldAreas.every((k) => newAreas.includes(k)) &&
          newAreas.every((k) => oldAreas.includes(k));
        if (!same) {
          changed.push({
            instanceId: booking.instanceId,
            oldAreas,
            newAreas,
            booking,
          });
        }
      });

      if (changed.length === 0) return;

      for (const item of changed) {
        const { error } = await supabase
          .from('booking_instances')
          .update({ areas: item.newAreas })
          .eq('id', item.instanceId);

        if (error) throw new Error(error.message);

        const slots = item.booking.area_slots ?? [];
        if (slots.length > 0) {
          const removed = item.oldAreas.filter(
            (k) => !item.newAreas.includes(k)
          );
          const added = item.newAreas.filter((k) => !item.oldAreas.includes(k));
          const replacement = new Map<string, string>();
          removed.forEach((from, idx) => {
            const to = added[idx];
            if (to) replacement.set(from, to);
          });

          const nextSlots = slots.map((slot) => {
            if (slot.area_key.startsWith('rack_')) return slot;
            const to = replacement.get(slot.area_key);
            if (to) return { ...slot, area_key: to };
            return slot;
          });

          await saveAreaSlotsForInstance(item.instanceId, nextSlots);
        }
      }

      await queryClient.invalidateQueries({
        queryKey: ['snapshot'],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ['booking-instances-debug'],
        exact: false,
      });
      setInitialAreaAssignments(new Map(areaAssignments));
      setAreaSavedAt(new Date());
    } catch (err) {
      setAreaDragError(
        err instanceof Error ? err.message : 'Failed to save area changes'
      );
    } finally {
      setAreaSaving(false);
    }
  };

  const {
    bookingById,
    assignments,
    setAssignments,
    initialAssignments,
    saving,
    savedAt,
    handleSave,
  } = useRackAssignments(bookingsForDisplay);

  const { activeId, dragError, handleDragStart, handleDragEnd } =
    useDragHandlers({
      assignments,
      setAssignments,
      initialAssignments,
      bookingById,
      availablePlatforms,
    });

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {!isSelectingRacks && (
        <>
          {liveViewMode === 'platforms' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLiveViewMode('areas')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                aria-label="Back to area map"
              >
                <span aria-hidden>←</span>
                Back to area map
              </button>
            </div>
          )}
          {!viewOnly && liveViewMode === 'platforms' && (
            <div className="flex justify-end">
              <RackEditorHeader
                saving={saving}
                savedAt={savedAt}
                onSave={handleSave}
              />
            </div>
          )}
          {!viewOnly && liveViewMode === 'areas' && (
            <div className="flex justify-end">
              <RackEditorHeader
                saving={areaSaving}
                savedAt={areaSavedAt}
                onSave={handleSaveAreaAssignments}
              />
            </div>
          )}
          {dragError && (
            <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-md">
              <p className="text-sm text-red-300 font-medium">{dragError}</p>
            </div>
          )}
          {areaDragError && (
            <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-md">
              <p className="text-sm text-red-300 font-medium">
                {areaDragError}
              </p>
            </div>
          )}
          {isClosedPeriod && (
            <div className="mt-2 px-3 py-2 rounded-md bg-slate-900/60 border border-slate-700 flex items-center gap-2">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              <p className="text-xs text-slate-200">
                Facility closed for this time — platforms are unavailable.
              </p>
            </div>
          )}
        </>
      )}

      {isSelectingRacks && (
        <RackSelectionPanel
          editingBooking={editingBooking}
          selectedRacks={selectedRacks}
          rackValidationError={rackValidationError}
          savingRacks={savingRacks}
          applyRacksToAll={applyRacksToAll}
          setApplyRacksToAll={(value) => {
            setApplyRacksToAll(value);
            // Clear validation error when selection changes
            if (rackValidationError) {
              setRackValidationError(null);
            }
          }}
          seriesInstancesForRacks={seriesInstancesForRacks}
          weeksForRacks={weeksForRacks}
          rackSelectionWeekIndex={rackSelectionWeekIndex}
          setRackSelectionWeekIndex={setRackSelectionWeekIndex}
          currentWeekInstancesForRacks={currentWeekInstancesForRacks}
          selectedInstancesForRacks={selectedInstancesForRacks}
          setSelectedInstancesForRacks={setSelectedInstancesForRacks}
          handleCancelRackSelection={handleCancelRackSelection}
          handleSaveRacks={handleSaveRacks}
        />
      )}
      <div
        ref={containerRef}
        className={`relative flex-1 min-h-0 rounded-lg p-2 overflow-hidden ${
          !isSelectingRacks && liveViewMode === 'areas'
            ? 'border border-slate-700 bg-[#020617]'
            : 'border border-slate-700 bg-slate-900/60'
        }`}
      >
        {/* When viewOnly (e.g. Session View), show Save as overlay so it doesn't shrink the map */}
        {viewOnly && !isSelectingRacks && liveViewMode === 'platforms' && (
          <div className="absolute top-2 right-2 z-10">
            <RackEditorHeader
              saving={saving}
              savedAt={savedAt}
              onSave={handleSave}
            />
          </div>
        )}
        {viewOnly && !isSelectingRacks && liveViewMode === 'areas' && (
          <div className="absolute top-2 right-2 z-10">
            <RackEditorHeader
              saving={areaSaving}
              savedAt={areaSavedAt}
              onSave={handleSaveAreaAssignments}
            />
          </div>
        )}
        {layout.length === 0 ? (
          <div className="text-xs text-slate-400 py-4 text-center">
            No data for this snapshot.
          </div>
        ) : !isSelectingRacks && liveViewMode === 'areas' ? (
          isPastSession ? (
            // Past session: show areas map but disable dragging (same as platforms)
            <div className="w-full h-full session-floorplan-enter">
              <MiniAreasFloorplan
                sideKey={side === 'base' ? 'Base' : 'Power'}
                selectedAreaKeys={highlightedAreas}
                areaBookingByKey={areaBookingByKey}
                enableAreaDrag={false}
                onEditBooking={
                  viewOnly ? onBookingClickWhenViewOnly : handleEditBooking
                }
                onAreaClick={() => {}}
                onPlatformsClick={() => setLiveViewMode('platforms')}
                areasInteractive={false}
                platformLabel="Platforms"
                platformOverlayFill="rgba(30, 58, 138, 0.22)"
                platformOverlayStroke="rgba(96, 165, 250, 0.55)"
                fit="contain"
                showOuterFrame={false}
              />
            </div>
          ) : (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleAreaDragEnd}
            >
              <div className="w-full h-full session-floorplan-enter">
                <MiniAreasFloorplan
                  sideKey={side === 'base' ? 'Base' : 'Power'}
                  selectedAreaKeys={highlightedAreas}
                  areaBookingByKey={areaBookingByKey}
                  enableAreaDrag
                  onEditBooking={
                    viewOnly ? onBookingClickWhenViewOnly : handleEditBooking
                  }
                  onAreaClick={() => {}}
                  onPlatformsClick={() => setLiveViewMode('platforms')}
                  areasInteractive={false}
                  platformLabel="Platforms"
                  platformOverlayFill="rgba(30, 58, 138, 0.22)"
                  platformOverlayStroke="rgba(96, 165, 250, 0.55)"
                  fit="contain"
                  showOuterFrame={false}
                />
              </div>
            </DndContext>
          )
        ) : isSelectingRacks ? (
          // When selecting racks, don't use DndContext to avoid interfering with clicks
          <div className="w-full h-full session-floorplan-enter">
            <div
              className="relative overflow-hidden"
              style={{ width: renderedWidth, height: renderedHeight }}
            >
              <RackEditorGrid
                layout={layout}
                assignments={assignments}
                bookingById={bookingById}
                activeId={null}
                beforeRacks={beforeRacks}
                showBanner={showBanner}
                bannerRowSpan={bannerRowSpan}
                gridTemplateColumns={gridTemplateColumns}
                numRows={numRows}
                spacerRow={spacerRow}
                BASE_WIDTH={BASE_WIDTH}
                BASE_HEIGHT={BASE_HEIGHT}
                zoomLevel={zoomLevel}
                onEditBooking={
                  viewOnly ? onBookingClickWhenViewOnly : handleEditBooking
                }
                isSelectingRacks={isSelectingRacks}
                selectedRacks={selectedRacks}
                editingBookingId={editingBooking?.instanceId ?? null}
                onRackClick={handleRackClick}
                bookings={bookingsForDisplay}
                availablePlatforms={availablePlatforms}
                isClosedPeriod={isClosedPeriod}
                isPastSession={false}
                viewOnly={viewOnly}
              />
            </div>
          </div>
        ) : isPastSession ? (
          // When session is in the past, render without DndContext to disable all dragging
          <div className="w-full h-full session-floorplan-enter">
            <div
              className="relative overflow-hidden"
              style={{ width: renderedWidth, height: renderedHeight }}
            >
              <RackEditorGrid
                layout={layout}
                assignments={assignments}
                bookingById={bookingById}
                activeId={null}
                beforeRacks={beforeRacks}
                showBanner={showBanner}
                bannerRowSpan={bannerRowSpan}
                gridTemplateColumns={gridTemplateColumns}
                numRows={numRows}
                spacerRow={spacerRow}
                BASE_WIDTH={BASE_WIDTH}
                BASE_HEIGHT={BASE_HEIGHT}
                zoomLevel={zoomLevel}
                onEditBooking={
                  viewOnly ? onBookingClickWhenViewOnly : handleEditBooking
                }
                isSelectingRacks={false}
                selectedRacks={[]}
                editingBookingId={editingBooking?.instanceId ?? null}
                onRackClick={handleRackClick}
                bookings={bookingsForDisplay}
                availablePlatforms={availablePlatforms}
                isClosedPeriod={isClosedPeriod}
                isPastSession={true}
                viewOnly={viewOnly}
              />
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="w-full h-full session-floorplan-enter">
              <div
                className="relative overflow-hidden"
                style={{ width: renderedWidth, height: renderedHeight }}
              >
                <RackEditorGrid
                  layout={layout}
                  assignments={assignments}
                  bookingById={bookingById}
                  activeId={activeId}
                  beforeRacks={beforeRacks}
                  showBanner={showBanner}
                  bannerRowSpan={bannerRowSpan}
                  gridTemplateColumns={gridTemplateColumns}
                  numRows={numRows}
                  spacerRow={spacerRow}
                  BASE_WIDTH={BASE_WIDTH}
                  BASE_HEIGHT={BASE_HEIGHT}
                  zoomLevel={zoomLevel}
                  onEditBooking={
                    viewOnly ? onBookingClickWhenViewOnly : handleEditBooking
                  }
                  isSelectingRacks={isSelectingRacks}
                  selectedRacks={selectedRacks}
                  editingBookingId={editingBooking?.instanceId ?? null}
                  onRackClick={handleRackClick}
                  bookings={bookingsForDisplay}
                  availablePlatforms={availablePlatforms}
                  isClosedPeriod={isClosedPeriod}
                  isPastSession={false}
                  viewOnly={viewOnly}
                />
              </div>
            </div>
            <DragOverlay>
              <RackEditorDragOverlay
                activeId={activeId}
                bookingById={bookingById}
                zoomLevel={zoomLevel}
              />
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Booking Editor Modal (only when not viewOnly) */}
      {!viewOnly && (
        <BookingEditorModal
          booking={editingBooking}
          isOpen={editingBooking !== null && !isSelectingRacks}
          onClose={handleCloseModal}
          onClearRacks={handleEditRacks}
          onSaveTime={handleSaveTime}
          initialSelectedInstances={
            savedSelectedInstances.size > 0 ? savedSelectedInstances : undefined
          }
        />
      )}

      {/* Session View: read-only booking info modal */}
      <SessionBookingInfoModal
        booking={viewingBooking}
        side={side}
        isOpen={viewingBooking !== null}
        onClose={() => setViewingBooking(null)}
      />

      {/* Update Racks Confirmation Dialog */}
      {isSelectingRacks && (
        <UpdateRacksConfirmationDialog
          isOpen={showUpdateRacksConfirm}
          sessionCount={selectedInstancesForRacks.size}
          racks={selectedRacks}
          onCancel={() => setShowUpdateRacksConfirm(false)}
          onConfirm={performRackUpdate}
          saving={savingRacks}
        />
      )}
    </div>
  );
}
