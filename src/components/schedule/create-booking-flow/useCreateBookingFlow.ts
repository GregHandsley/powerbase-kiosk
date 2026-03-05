import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Resolver, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import {
  BookingFormSchemaTimeFirst,
  type BookingFormValues,
} from '../../../schemas/bookingForm';
import {
  getSideIdByKeyNode,
  type SideKey,
} from '../../../nodes/data/sidesNodes';
import {
  useClosedTimes,
  isTimeRangeClosed,
} from '../../admin/capacity/useClosedTimes';
import { useAreas } from '../../admin/booking/useAreas';
import { useTimeDefaults } from '../../admin/booking/useTimeDefaults';
import { calculateEndTime } from '../../admin/booking/utils';
import { useWeekManagement } from '../../admin/booking/useWeekManagement';
import { useBookingSubmission } from '../../admin/booking/useBookingSubmission';
import { useCapacityValidation } from '../../admin/booking/useCapacityValidation';
import { useBookedAreaKeys } from '../../../hooks/useBookedAreaKeys';
import {
  checkBookingConflictsForReview,
  type ReviewConflict,
} from '../../admin/booking/checkBookingConflicts';
import { supabase } from '../../../lib/supabaseClient';
import { roundTo15Minutes, someSlotsDontFillWindow } from './utils';
import { STEP_TIME, STEP_EQUIPMENT, STEP_REVIEW } from './constants';
import type { BookingFamily, BookingSquad } from './types';
import type { CreateBookingFlowProps } from './types';
import type { OrgRole } from '../../../types/auth';

export function useCreateBookingFlow({
  isOpen,
  onClose,
  onSuccess,
  role,
  initialDate,
  initialStartTime,
  initialEndTime,
  initialSide,
  initialRacks,
  userId,
  primaryOrgId,
}: CreateBookingFlowProps & {
  userId: string | null;
  primaryOrgId: number | null;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(STEP_TIME);
  const [weeksTooltipVisible, setWeeksTooltipVisible] = useState(false);
  const [partialWindowConfirm, setPartialWindowConfirm] =
    useState<BookingFormValues | null>(null);
  const [reviewConflicts, setReviewConflicts] = useState<ReviewConflict[]>([]);
  const [reviewConflictsLoading, setReviewConflictsLoading] = useState(false);
  const [reviewConflictsError, setReviewConflictsError] = useState<
    string | null
  >(null);
  const [finalConfirmValues, setFinalConfirmValues] =
    useState<BookingFormValues | null>(null);
  const endTimeManuallyChangedRef = useRef(false);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(
      BookingFormSchemaTimeFirst
    ) as Resolver<BookingFormValues>,
    defaultValues: {
      bookingType: 'catalogue',
      squadFamilyId: null,
      squadId: null,
      oneOffName: '',
      title: '',
      sideKey: 'Power',
      startDate: todayStr,
      startTime: '07:00',
      endTime: '08:30',
      weeks: 1,
      racksInput: '',
      areas: [],
      isLocked: false,
      emergencyReason: '',
      capacity: 1,
      areaSlots: [],
      platformSlots: [],
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    if (initialDate && initialStartTime && initialEndTime && initialSide) {
      const defaultVals = {
        bookingType: 'catalogue' as const,
        squadFamilyId: null,
        squadId: null,
        oneOffName: '',
        title: '',
        sideKey: initialSide,
        startDate: initialDate,
        startTime: initialStartTime,
        endTime: initialEndTime,
        weeks: 1,
        racksInput: initialRacks?.length ? initialRacks.join(', ') : '',
        areas: [] as string[],
        isLocked: false,
        emergencyReason: '',
        capacity: 1,
        areaSlots: [] as Array<{
          area_key: string;
          start: string;
          end: string;
        }>,
        platformSlots:
          initialRacks?.length && initialStartTime && initialEndTime
            ? initialRacks.map((rackNumber) => ({
                rackNumber,
                start: initialStartTime,
                end: initialEndTime,
              }))
            : [],
      };
      form.reset(defaultVals);
    }
  }, [
    isOpen,
    initialDate,
    initialStartTime,
    initialEndTime,
    initialSide,
    initialRacks,
    form,
  ]);

  const sideKey = useWatch({ control: form.control, name: 'sideKey' });
  const startDate = useWatch({ control: form.control, name: 'startDate' });
  const startTime = useWatch({ control: form.control, name: 'startTime' });
  const endTime = useWatch({ control: form.control, name: 'endTime' });
  const capacity = useWatch({ control: form.control, name: 'capacity' }) ?? 1;
  const bookingType = useWatch({ control: form.control, name: 'bookingType' });
  const selectedFamilyId = useWatch({
    control: form.control,
    name: 'squadFamilyId',
  });
  const selectedSquadId = useWatch({ control: form.control, name: 'squadId' });
  const oneOffName = useWatch({ control: form.control, name: 'oneOffName' });
  const areaSlots = useWatch({ control: form.control, name: 'areaSlots' });
  const platformSlots = useWatch({
    control: form.control,
    name: 'platformSlots',
  });
  const weeks = useWatch({ control: form.control, name: 'weeks' }) ?? 1;

  const [sideId, setSideId] = useState<number | null>(null);
  const [freeIntervalsByRack, setFreeIntervalsByRack] = useState<
    Map<number, Array<{ start: string; end: string }>>
  >(() => new Map());

  const handleFreeIntervalsComputed = useCallback(
    (map: Map<number, Array<{ start: string; end: string }>>) => {
      setFreeIntervalsByRack(new Map(map));
    },
    []
  );

  useEffect(() => {
    getSideIdByKeyNode(sideKey as SideKey)
      .then(setSideId)
      .catch(console.error);
  }, [sideKey]);

  const { areas } = useAreas();
  const {
    closedTimes,
    closedPeriods,
    isLoading: closedTimesLoading,
  } = useClosedTimes(sideId, startDate || null);
  const {
    endTimeManuallyChanged,
    setEndTimeManuallyChanged,
    firstAvailableTime,
  } = useTimeDefaults(
    form as UseFormReturn<BookingFormValues>,
    sideId,
    startDate,
    closedTimes ?? new Set(),
    closedTimesLoading,
    closedPeriods ?? []
  );

  const onEndTimeChange = useCallback(() => {
    endTimeManuallyChangedRef.current = true;
    setEndTimeManuallyChanged(true);
  }, [setEndTimeManuallyChanged]);

  useEffect(() => {
    if (!isOpen || step !== STEP_TIME || !startTime) return;
    if (endTimeManuallyChangedRef.current) return;
    const closed = closedTimes ?? new Set();
    const calculated = calculateEndTime(startTime, 90, closed);
    const newEnd = calculated
      ? roundTo15Minutes(calculated)
      : (() => {
          const [h, m] = startTime.split(':').map(Number);
          const total = (h ?? 0) * 60 + (m ?? 0) + 90;
          const endH = Math.floor(total / 60) % 24;
          const endM = total % 60;
          return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        })();
    const roundedEnd = roundTo15Minutes(newEnd);
    form.setValue('endTime', roundedEnd, { shouldValidate: true });
  }, [isOpen, step, startTime, closedTimes, form]);

  const timeRangeIsClosed =
    startTime && endTime && closedTimes && closedPeriods
      ? isTimeRangeClosed(closedTimes, startTime, endTime, closedPeriods)
      : false;

  const weekManagement = useWeekManagement(
    form as UseFormReturn<BookingFormValues>
  );

  const capacityValidation = useCapacityValidation(
    sideKey as 'Power' | 'Base',
    startDate || null,
    startTime || null,
    endTime || null,
    capacity,
    weeks,
    weekManagement.racksByWeek,
    weekManagement.capacityByWeek
  );

  const { onSubmit, submitError, submitting, submitMessage } =
    useBookingSubmission(
      form as UseFormReturn<BookingFormValues>,
      role as OrgRole,
      userId,
      timeRangeIsClosed,
      weekManagement,
      capacityValidation,
      { allowNoRacksIfAreaSlots: true }
    );

  const { data: bookingFamilies = [], isLoading: bookingFamiliesLoading } =
    useQuery({
      queryKey: ['booking-families', primaryOrgId],
      queryFn: async () => {
        if (!primaryOrgId) return [] as BookingFamily[];
        const { data, error } = await supabase
          .from('booking_families')
          .select('id, organization_id, name, active, sort_order')
          .eq('organization_id', primaryOrgId)
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });
        if (error) throw error;
        return (data ?? []) as BookingFamily[];
      },
      enabled: isOpen && !!primaryOrgId,
    });

  const { data: bookingSquads = [] } = useQuery({
    queryKey: ['booking-squads', primaryOrgId],
    queryFn: async () => {
      if (!primaryOrgId) return [] as BookingSquad[];
      const { data, error } = await supabase
        .from('booking_squads')
        .select(
          'id, family_id, organization_id, name, logo_url, active, sort_order'
        )
        .eq('organization_id', primaryOrgId)
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BookingSquad[];
    },
    enabled: isOpen && !!primaryOrgId,
  });

  const filteredSquads = useMemo(
    () =>
      !selectedFamilyId
        ? ([] as BookingSquad[])
        : bookingSquads.filter((s) => s.family_id === selectedFamilyId),
    [bookingSquads, selectedFamilyId]
  );

  const selectedSquad = useMemo(
    () => bookingSquads.find((s) => s.id === selectedSquadId) ?? null,
    [bookingSquads, selectedSquadId]
  );

  useEffect(() => {
    if (bookingType === 'catalogue' && selectedSquad) {
      form.setValue('title', selectedSquad.name, { shouldValidate: true });
    } else if (bookingType === 'one_off') {
      form.setValue('title', oneOffName?.trim() ?? '', {
        shouldValidate: true,
      });
    }
  }, [bookingType, selectedSquad, oneOffName, form]);

  useEffect(() => {
    if (bookingType === 'one_off') {
      form.setValue('weeks', 1, { shouldValidate: true });
    }
  }, [bookingType, form]);

  useEffect(() => {
    if (submitMessage && onSuccess) {
      onSuccess();
      onClose();
    }
  }, [submitMessage, onSuccess, onClose]);

  useEffect(() => {
    if (isOpen) {
      setStep(STEP_TIME);
      setPartialWindowConfirm(null);
      setFinalConfirmValues(null);
      setReviewConflicts([]);
      setReviewConflictsError(null);
      endTimeManuallyChangedRef.current = false;
      setEndTimeManuallyChanged(false);
      queryClient.invalidateQueries({
        queryKey: ['existing-instances-for-capacity-check'],
      });
      queryClient.invalidateQueries({
        queryKey: ['capacity-schedules-for-validation'],
      });
    }
  }, [isOpen, setEndTimeManuallyChanged, queryClient]);

  const { bookedAreaKeys, freeIntervalsByArea } = useBookedAreaKeys(
    sideId,
    startDate ?? null,
    startTime ?? null,
    endTime ?? null,
    weekManagement.currentWeekIndex
  );

  useEffect(() => {
    if (step !== STEP_EQUIPMENT || weekManagement.weeksCount === 0) return;
    const set = new Set<number>();
    if (weekManagement.applyToAllWeeks || weekManagement.weeksCount === 1) {
      for (let i = 0; i < weekManagement.weeksCount; i++) {
        (weekManagement.racksByWeek.get(i) ?? []).forEach((r) => set.add(r));
      }
    } else {
      (
        weekManagement.racksByWeek.get(weekManagement.currentWeekIndex) ?? []
      ).forEach((r) => set.add(r));
    }
    const currentRacks = Array.from(set).sort((a, b) => a - b);
    const slots = form.getValues('platformSlots') ?? [];
    const existingRackSet = new Set(slots.map((p) => p.rackNumber));
    const added = currentRacks.filter((r) => !existingRackSet.has(r));
    const removed = slots.filter((p) => !set.has(p.rackNumber));
    if (added.length === 0 && removed.length === 0) return;
    const windowStart = startTime ?? '07:00';
    const windowEnd = endTime ?? '08:30';
    let next = slots
      .filter((p) => set.has(p.rackNumber))
      .sort((a, b) => a.rackNumber - b.rackNumber);
    for (const rackNumber of added) {
      const interval = freeIntervalsByRack.get(rackNumber)?.[0];
      next = [
        ...next,
        {
          rackNumber,
          start: interval?.start ?? windowStart,
          end: interval?.end ?? windowEnd,
        },
      ];
    }
    next.sort((a, b) => a.rackNumber - b.rackNumber);
    form.setValue('platformSlots', next, { shouldValidate: false });
  }, [
    step,
    weekManagement.weeksCount,
    weekManagement.racksByWeek,
    weekManagement.currentWeekIndex,
    weekManagement.applyToAllWeeks,
    startTime,
    endTime,
    form,
    freeIntervalsByRack,
  ]);

  const canGoToEquipment =
    startDate &&
    startTime &&
    endTime &&
    capacity >= 1 &&
    (bookingType === 'one_off' ? oneOffName?.trim() : selectedSquadId) &&
    !timeRangeIsClosed &&
    capacityValidation.isValid;

  const hasAnyRacksOrAreas = useMemo(() => {
    const hasRacks = Array.from(
      { length: weekManagement.weeksCount },
      (_, i) => (weekManagement.racksByWeek.get(i) ?? []).length
    ).some((n) => n > 0);
    const hasSlots = (areaSlots?.length ?? 0) > 0;
    return hasRacks || hasSlots;
  }, [weekManagement.weeksCount, weekManagement.racksByWeek, areaSlots]);

  const handleNext = useCallback(() => {
    if (step === STEP_TIME && canGoToEquipment) setStep(STEP_EQUIPMENT);
    if (step === STEP_EQUIPMENT && hasAnyRacksOrAreas) setStep(STEP_REVIEW);
  }, [step, canGoToEquipment, hasAnyRacksOrAreas]);

  const handleBack = useCallback(() => {
    if (step === STEP_REVIEW) setStep(STEP_EQUIPMENT);
    else if (step === STEP_EQUIPMENT) setStep(STEP_TIME);
  }, [step]);

  useEffect(() => {
    if (step !== STEP_EQUIPMENT) return;
    const hasAnyRacks = Array.from(
      { length: weekManagement.weeksCount },
      (_, i) => (weekManagement.racksByWeek.get(i) ?? []).length
    ).some((n) => n > 0);
    const hasSlots = (areaSlots?.length ?? 0) > 0;
    if (hasAnyRacks || hasSlots) {
      form.clearErrors('racksInput');
      form.clearErrors('areaSlots');
    }
  }, [
    step,
    weekManagement.weeksCount,
    weekManagement.racksByWeek,
    areaSlots,
    form,
  ]);

  useEffect(() => {
    if (
      step !== STEP_REVIEW ||
      !sideId ||
      !startDate ||
      !startTime ||
      !endTime ||
      weekManagement.weeksCount < 1
    ) {
      if (step !== STEP_REVIEW) {
        setReviewConflicts([]);
        setReviewConflictsError(null);
      }
      return;
    }
    let cancelled = false;
    setReviewConflictsLoading(true);
    setReviewConflictsError(null);
    checkBookingConflictsForReview({
      sideId,
      startDate,
      startTime,
      endTime,
      weeks: weekManagement.weeksCount,
      racksByWeek: weekManagement.racksByWeek,
    })
      .then(({ conflicts }) => {
        if (!cancelled) setReviewConflicts(conflicts);
      })
      .catch((err) => {
        if (!cancelled) {
          setReviewConflictsError(
            err instanceof Error ? err.message : 'Failed to check conflicts'
          );
          setReviewConflicts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setReviewConflictsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    step,
    sideId,
    startDate,
    startTime,
    endTime,
    weekManagement.weeksCount,
    weekManagement.racksByWeek,
  ]);

  const setFormError = useCallback(
    (field: 'racksInput' | 'areaSlots', message: string) => {
      form.setError(field, { message });
    },
    [form]
  );

  const handleConfirmCreate = useCallback(() => {
    const values = form.getValues();
    if (someSlotsDontFillWindow(values)) {
      setPartialWindowConfirm(values);
      return;
    }
    setFinalConfirmValues(values);
  }, [form]);

  const handleEditWeek = useCallback(
    (weekIndex: number) => {
      weekManagement.setCurrentWeekIndex(weekIndex);
      weekManagement.setApplyToAllWeeks(false);
      setStep(STEP_EQUIPMENT);
    },
    [weekManagement]
  );

  return {
    form,
    step,
    weeksTooltipVisible,
    setWeeksTooltipVisible,
    partialWindowConfirm,
    setPartialWindowConfirm,
    finalConfirmValues,
    setFinalConfirmValues,
    sideKey: sideKey as 'Power' | 'Base',
    sideId,
    startDate,
    startTime,
    endTime,
    capacity,
    bookingType,
    selectedFamilyId,
    selectedSquadId,
    oneOffName,
    areaSlots,
    platformSlots,
    closedTimes: closedTimes ?? new Set(),
    closedPeriods: closedPeriods ?? [],
    firstAvailableTime: firstAvailableTime ?? '07:00',
    endTimeManuallyChanged,
    onEndTimeChange,
    weekManagement,
    capacityValidation,
    bookingFamilies,
    bookingSquads,
    filteredSquads,
    selectedSquad,
    bookingFamiliesLoading,
    areas,
    bookedAreaKeys,
    freeIntervalsByArea,
    freeIntervalsByRack,
    handleFreeIntervalsComputed,
    canGoToEquipment,
    hasAnyRacksOrAreas,
    handleNext,
    handleBack,
    setStep,
    reviewConflicts,
    reviewConflictsLoading,
    reviewConflictsError,
    submitError,
    submitting,
    onSubmit,
    setFormError,
    handleConfirmCreate,
    handleEditWeek,
  };
}
