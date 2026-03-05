import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  formatTimeForInput,
  groupInstancesByWeek,
} from '../../../shared/dateUtils';
import type { ActiveInstance } from '../../../../types/snapshot';
import { useAuth } from '../../../../context/AuthContext';
import { useSeriesInstances } from './useSeriesInstances';
import { performBookingUpdate } from '../perform/performBookingUpdate';
import { performBookingCancel } from '../perform/performBookingCancel';
import { performBookingExtend } from '../perform/performBookingExtend';
import type { AreaSlotFormEntry, CancelMode, OriginalValues } from '../types';

export type { SeriesInstance } from '../types';

export function useBookingEditor(
  booking: ActiveInstance | null,
  isOpen: boolean,
  initialSelectedInstances?: Set<number>
) {
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const { data: seriesInstances = [] } = useSeriesInstances(booking, isOpen);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelMode, setCancelMode] = useState<CancelMode>('single');
  const [cancelling, setCancelling] = useState(false);
  const [selectedInstances, setSelectedInstances] = useState<Set<number>>(
    new Set()
  );
  const [applyToAll, setApplyToAll] = useState(false);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [extendWeeks, setExtendWeeks] = useState(1);
  const [extending, setExtending] = useState(false);
  const [showUpdateTimeConfirm, setShowUpdateTimeConfirm] = useState(false);
  const [areaSlotsForm, setAreaSlotsForm] = useState<AreaSlotFormEntry[]>([]);
  const [originalValues, setOriginalValues] = useState<OriginalValues>(null);
  const [userHasEdited, setUserHasEdited] = useState(false);

  const bookingId = booking?.bookingId ?? null;
  const instanceId = booking?.instanceId ?? null;
  const initialIdsKey =
    initialSelectedInstances && initialSelectedInstances.size > 0
      ? [...initialSelectedInstances].sort((a, b) => a - b).join(',')
      : '';
  const seriesInstanceIdsKey =
    seriesInstances.length > 0
      ? seriesInstances
          .map((i) => i.id)
          .sort((a, b) => a - b)
          .join(',')
      : '';
  const selectedIdsKey =
    selectedInstances.size === 0
      ? ''
      : [...selectedInstances].sort((a, b) => a - b).join(',');

  useEffect(() => {
    if (booking) {
      const initialStartTime = formatTimeForInput(booking.start);
      const initialEndTime = formatTimeForInput(booking.end);
      const initialCapacity = booking.capacity || 1;

      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setCapacity(initialCapacity);
      setOriginalValues({
        startTime: initialStartTime,
        endTime: initialEndTime,
        capacity: initialCapacity,
      });

      if (initialSelectedInstances && initialSelectedInstances.size > 0) {
        setSelectedInstances(new Set(initialSelectedInstances));
      } else {
        setSelectedInstances(new Set([booking.instanceId]));
      }
      setApplyToAll(true);
      if (!initialSelectedInstances || initialSelectedInstances.size === 0) {
        setCurrentWeekIndex(0);
      }
      setUserHasEdited(false);
    } else {
      setStartTime('');
      setEndTime('');
      setCapacity(1);
      setSelectedInstances(new Set());
      setApplyToAll(true);
      setCurrentWeekIndex(0);
      setOriginalValues(null);
      setUserHasEdited(false);
      setAreaSlotsForm([]);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable keys (bookingId, initialIdsKey) to avoid parent re-render loops
  }, [
    bookingId,
    instanceId,
    initialIdsKey,
    booking?.start,
    booking?.end,
    booking?.capacity,
  ]);

  useEffect(() => {
    if (selectedInstances.size === 0 || seriesInstances.length === 0) {
      setAreaSlotsForm([]);
      return;
    }
    const firstId = Math.min(...selectedInstances);
    const inst = seriesInstances.find((i) => i.id === firstId);
    if (!inst?.area_slots?.length) {
      setAreaSlotsForm([]);
      return;
    }
    setAreaSlotsForm(
      inst.area_slots.map((slot) => ({
        area_key: slot.area_key,
        start: format(parseISO(slot.start), 'HH:mm'),
        end: format(parseISO(slot.end), 'HH:mm'),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable keys (selectedIdsKey, seriesInstanceIdsKey) to avoid loops
  }, [selectedIdsKey, seriesInstanceIdsKey]);

  useEffect(() => {
    if (applyToAll && booking && seriesInstances.length > 0) {
      setSelectedInstances(new Set(seriesInstances.map((inst) => inst.id)));
    } else if (!applyToAll && booking && seriesInstances.length > 0) {
      if (!initialSelectedInstances || initialSelectedInstances.size === 0) {
        setSelectedInstances(new Set());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable keys to avoid parent re-render loops
  }, [applyToAll, bookingId, seriesInstanceIdsKey, initialIdsKey]);

  useEffect(() => {
    if (
      !applyToAll &&
      booking &&
      seriesInstances.length > 0 &&
      !userHasEdited
    ) {
      const instancesByWeek = groupInstancesByWeek(seriesInstances);
      const weeks = Array.from(instancesByWeek.keys()).sort((a, b) => a - b);
      const currentWeek = weeks[currentWeekIndex] ?? weeks[0] ?? null;
      const currentWeekInstances = currentWeek
        ? (instancesByWeek.get(currentWeek) ?? [])
        : [];

      if (currentWeekInstances.length > 0) {
        const firstInstance = currentWeekInstances[0];
        const instanceData = seriesInstances.find(
          (inst) => inst.id === firstInstance.id
        );
        if (instanceData?.capacity !== undefined) {
          setCapacity(instanceData.capacity);
        } else {
          setCapacity(booking.capacity || 1);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable keys to avoid parent re-render loops
  }, [
    currentWeekIndex,
    applyToAll,
    bookingId,
    seriesInstanceIdsKey,
    userHasEdited,
  ]);

  const hasTimeChanges = useMemo(() => {
    if (!booking || !originalValues) return false;
    return (
      startTime !== originalValues.startTime ||
      endTime !== originalValues.endTime
    );
  }, [booking, startTime, endTime, originalValues]);

  const hasCapacityChanges = useMemo(() => {
    if (!booking || !originalValues) return false;
    return capacity !== originalValues.capacity || userHasEdited;
  }, [booking, capacity, originalValues, userHasEdited]);

  const hasChanges = useMemo(() => {
    if (!booking || selectedInstances.size === 0) return false;
    return hasTimeChanges || hasCapacityChanges;
  }, [booking, selectedInstances.size, hasTimeChanges, hasCapacityChanges]);

  const handleSaveTime = async (): Promise<boolean> => {
    if (!booking || !hasChanges) return true;

    if (hasTimeChanges) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        setError('Time must be in HH:mm format');
        return false;
      }
    }

    if (capacity < 1 || capacity > 100) {
      setError('Number of athletes must be between 1 and 100');
      return false;
    }

    if (selectedInstances.size === 0) {
      setError('Please select at least one session to update');
      return false;
    }

    setShowUpdateTimeConfirm(true);
    return false;
  };

  const performUpdate = async (): Promise<boolean> => {
    if (!booking) return false;
    return performBookingUpdate({
      booking,
      selectedInstances,
      seriesInstances,
      startTime,
      endTime,
      capacity,
      hasTimeChanges,
      hasCapacityChanges,
      areaSlotsForm,
      originalValues,
      setError,
      setSaving,
      queryClient,
      userId: user?.id ?? null,
      role: role ?? undefined,
    });
  };

  const handleCancelBooking = async (): Promise<boolean> => {
    if (!booking || !user) return false;
    return performBookingCancel({
      booking,
      userId: user.id,
      seriesInstances,
      cancelMode,
      setCancelling,
      setError,
      setShowCancelDialog,
      queryClient,
    });
  };

  const handleExtendBooking = async (): Promise<boolean> => {
    if (!booking || seriesInstances.length === 0 || extendWeeks < 1)
      return false;
    return performBookingExtend({
      booking,
      userId: user?.id ?? null,
      seriesInstances,
      extendWeeks,
      setExtending,
      setError,
      setShowExtendDialog,
      setExtendWeeks,
      queryClient,
    });
  };

  const handleInstanceToggle = (instanceId: number) => {
    const newSelected = new Set(selectedInstances);
    if (newSelected.has(instanceId)) {
      newSelected.delete(instanceId);
    } else {
      newSelected.add(instanceId);
    }
    setSelectedInstances(newSelected);
    if (newSelected.size === seriesInstances.length) {
      setApplyToAll(true);
    } else if (newSelected.size < seriesInstances.length) {
      setApplyToAll(false);
    }
  };

  const handleCapacityChange = (value: number) => {
    setCapacity(value);
    setUserHasEdited(true);
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    setUserHasEdited(true);
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    setUserHasEdited(true);
  };

  const firstSelectedInstanceForSlots = seriesInstances.find((i) =>
    selectedInstances.has(i.id)
  );

  return {
    startTime,
    endTime,
    capacity,
    saving,
    error,
    showCancelDialog,
    cancelMode,
    cancelling,
    selectedInstances,
    applyToAll,
    currentWeekIndex,
    showExtendDialog,
    extendWeeks,
    extending,
    seriesInstances,
    hasTimeChanges,
    hasCapacityChanges,
    hasChanges,
    showUpdateTimeConfirm,
    setStartTime: handleStartTimeChange,
    setEndTime: handleEndTimeChange,
    setCapacity: handleCapacityChange,
    setError,
    setShowCancelDialog,
    setCancelMode,
    setApplyToAll,
    setCurrentWeekIndex,
    setShowExtendDialog,
    setExtendWeeks,
    setSelectedInstances,
    setShowUpdateTimeConfirm,
    areaSlotsForm,
    setAreaSlotsForm,
    firstSelectedInstanceForSlots,
    handleSaveTime,
    performUpdate,
    handleCancelBooking,
    handleExtendBooking,
    handleInstanceToggle,
  };
}
