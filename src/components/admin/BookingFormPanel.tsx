import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import {
  BookingFormSchema,
  type BookingFormValues,
} from '../../schemas/bookingForm';
import { getSideIdByKeyNode, type SideKey } from '../../nodes/data/sidesNodes';
import { useClosedTimes, isTimeRangeClosed } from './capacity/useClosedTimes';
import { useAreas } from './booking/useAreas';
import { useTimeDefaults } from './booking/useTimeDefaults';
import { useWeekManagement } from './booking/useWeekManagement';
import { useBookingSubmission } from './booking/useBookingSubmission';
import { useCapacityValidation } from './booking/useCapacityValidation';
import { BookingTimeInputs } from './booking/BookingTimeInputs';
import { BookingPlatformSelection } from './booking/BookingPlatformSelection';
import { CapacityDisplay } from './booking/CapacityDisplay';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import {
  usePermission,
  usePrimaryOrganizationId,
} from '../../hooks/usePermissions';
import type { OrgRole } from '../../types/auth';
import { isAdminRole } from '../../types/auth';
import clsx from 'clsx';
import { ModalPortal } from '../shared/ModalPortal';
import { supabase } from '../../lib/supabaseClient';

type BookingFamily = {
  id: number;
  organization_id: number;
  name: string;
  active: boolean;
  sort_order: number;
};

type BookingSquad = {
  id: number;
  family_id: number;
  organization_id: number;
  name: string;
  logo_url: string | null;
  active: boolean;
  sort_order: number;
};

type Props = {
  role: OrgRole; // Now accepts all org roles (2.3.1)
  /** Optional initial values to pre-fill the form */
  initialValues?: Partial<BookingFormValues>;
  /** Callback when booking is successfully created */
  onSuccess?: () => void;
};

export function BookingFormPanel({ role, initialValues, onSuccess }: Props) {
  const { user } = useAuth();
  const { areas, areasLoading, areasError } = useAreas();

  // Check permissions for creating bookings
  const { organizationId: primaryOrgId } = usePrimaryOrganizationId();
  const { hasPermission: canCreateBookings } = usePermission(
    primaryOrgId,
    'bookings.create'
  );

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(BookingFormSchema),
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
      ...initialValues,
    },
  });

  // Reset form when initialValues change
  useEffect(() => {
    if (initialValues) {
      // Use a deep comparison or stringify to ensure we detect changes
      // Ensure sideKey is properly typed as the union type
      const sideKeyValue: BookingFormValues['sideKey'] =
        initialValues.sideKey === 'Power' || initialValues.sideKey === 'Base'
          ? initialValues.sideKey
          : 'Power';

      const valuesToSet: BookingFormValues = {
        bookingType: 'catalogue',
        squadFamilyId: null,
        squadId: null,
        oneOffName: '',
        title: '',
        startDate: todayStr,
        startTime: '07:00',
        endTime: '08:30',
        weeks: 1,
        racksInput: '',
        areas: [],
        isLocked: false,
        emergencyReason: '',
        capacity: 1,
        ...initialValues,
        // Ensure sideKey is properly typed after spread (override if needed)
        sideKey: sideKeyValue,
      };
      form.reset(valuesToSet, { keepDefaultValues: false });
    }
  }, [initialValues, form, todayStr]);

  // Get side ID for closed times check
  const [sideId, setSideId] = useState<number | null>(null);
  const sideKey = useWatch({ control: form.control, name: 'sideKey' });
  const bookingType = useWatch({ control: form.control, name: 'bookingType' });
  const selectedFamilyId = useWatch({
    control: form.control,
    name: 'squadFamilyId',
  });
  const selectedSquadId = useWatch({ control: form.control, name: 'squadId' });
  const oneOffName = useWatch({ control: form.control, name: 'oneOffName' });
  const startDate = useWatch({ control: form.control, name: 'startDate' });

  useEffect(() => {
    getSideIdByKeyNode(sideKey as SideKey)
      .then(setSideId)
      .catch(console.error);
  }, [sideKey]);

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
      enabled: !!primaryOrgId,
    });

  const { data: bookingSquads = [], isLoading: bookingSquadsLoading } =
    useQuery({
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
      enabled: !!primaryOrgId,
    });

  const filteredSquads = useMemo(() => {
    if (!selectedFamilyId) return [] as BookingSquad[];
    return bookingSquads.filter(
      (squad) => squad.family_id === selectedFamilyId
    );
  }, [bookingSquads, selectedFamilyId]);

  const selectedSquad = useMemo(
    () => bookingSquads.find((squad) => squad.id === selectedSquadId) ?? null,
    [bookingSquads, selectedSquadId]
  );

  useEffect(() => {
    if (bookingType === 'catalogue') {
      if (selectedSquad) {
        form.setValue('title', selectedSquad.name, { shouldValidate: true });
      } else {
        form.setValue('title', '', { shouldValidate: true });
      }
      return;
    }

    form.setValue('title', oneOffName?.trim() ?? '', { shouldValidate: true });
  }, [bookingType, selectedSquad, oneOffName, form]);

  useEffect(() => {
    if (bookingType !== 'catalogue') return;
    if (!selectedFamilyId) {
      form.setValue('squadId', null, { shouldValidate: false });
      return;
    }
    const hasSelectedSquad = filteredSquads.some(
      (squad) => squad.id === selectedSquadId
    );
    if (!hasSelectedSquad) {
      form.setValue('squadId', null, { shouldValidate: false });
    }
  }, [bookingType, selectedFamilyId, selectedSquadId, filteredSquads, form]);

  useEffect(() => {
    if (bookingFamiliesLoading || bookingSquadsLoading) return;
    if (bookingFamilies.length === 0 || bookingSquads.length === 0) {
      form.setValue('bookingType', 'one_off', { shouldValidate: true });
    }
  }, [
    bookingFamiliesLoading,
    bookingSquadsLoading,
    bookingFamilies.length,
    bookingSquads.length,
    form,
  ]);

  // Get closed times for the selected date and side
  const {
    closedTimes,
    closedPeriods,
    isLoading: closedTimesLoading,
  } = useClosedTimes(sideId, startDate || null);

  // Hard cutoff settings
  const { settings: notificationSettings } = useNotificationSettings();
  const hardRestrictionEnabled =
    notificationSettings?.hard_restriction_enabled ?? true;
  const cutoffHours = notificationSettings?.hard_restriction_hours ?? 12;

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideReasonError, setOverrideReasonError] = useState<string | null>(
    null
  );
  const successHandledRef = useRef(false);

  // Check if selected times are closed
  const startTime = useWatch({ control: form.control, name: 'startTime' });
  const endTime = useWatch({ control: form.control, name: 'endTime' });
  const capacity = useWatch({ control: form.control, name: 'capacity' });
  const weeks = useWatch({ control: form.control, name: 'weeks' });
  const canCreateOneOff = useMemo(() => {
    const allowedRoles = notificationSettings?.one_off_allowed_roles;
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.includes(role);
  }, [notificationSettings?.one_off_allowed_roles, role]);
  // Check if any time in the range is closed
  const timeRangeIsClosed = useMemo(() => {
    if (!startTime || !endTime) return false;
    return isTimeRangeClosed(closedTimes, startTime, endTime, closedPeriods);
  }, [startTime, endTime, closedTimes, closedPeriods]);

  // Determine if we're inside the hard cutoff window
  const isInsideHardCutoff = useMemo(() => {
    if (!hardRestrictionEnabled || !startDate || !startTime) return false;
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const hoursUntil =
      (startDateTime.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return hoursUntil < cutoffHours;
  }, [hardRestrictionEnabled, startDate, startTime, cutoffHours]);

  // Time defaults management
  const {
    endTimeManuallyChanged,
    setEndTimeManuallyChanged,
    firstAvailableTime,
  } = useTimeDefaults(
    form,
    sideId,
    startDate,
    closedTimes,
    closedTimesLoading,
    closedPeriods
  );

  // Week-by-week management
  const weekManagement = useWeekManagement(form);

  // Capacity validation
  const capacityValidation = useCapacityValidation(
    sideKey as 'Power' | 'Base',
    startDate || null,
    startTime || null,
    endTime || null,
    capacity || 1,
    weeks || 1,
    weekManagement.racksByWeek,
    weekManagement.capacityByWeek
  );

  // Booking submission
  const { onSubmit, submitMessage, submitError, submitting } =
    useBookingSubmission(
      form,
      role,
      user?.id || null,
      timeRangeIsClosed,
      weekManagement,
      capacityValidation
    );

  // Wrapper to enforce cutoff UX before calling onSubmit
  const handleSubmitWithCutoff = form.handleSubmit((vals) => {
    if (vals.bookingType === 'catalogue') {
      if (!vals.squadFamilyId) {
        setInlineError(
          'Please select a family before creating a squad booking.'
        );
        return;
      }
      if (!vals.squadId) {
        setInlineError(
          'Please select a squad before creating a squad booking.'
        );
        return;
      }
    } else {
      if (!vals.oneOffName?.trim()) {
        setInlineError(
          'Please enter a one-off booking name before creating the booking.'
        );
        return;
      }
    }

    if (hardRestrictionEnabled && isInsideHardCutoff) {
      // Non-admins are blocked inside the cutoff window
      if (!isAdminRole(role)) {
        setInlineError(
          `Bookings must be made at least ${cutoffHours} hours in advance. Please speak to the on-site team to handle this.`
        );
        return;
      }

      // Admins must supply a reason; show modal if missing
      const reason =
        overrideReason.trim() || vals.emergencyReason?.trim() || '';
      if (!reason) {
        setInlineError(null);
        setOverrideReason('');
        setOverrideReasonError(null);
        setOverrideModalOpen(true);
        return;
      }

      vals.emergencyReason = reason;
    }

    setInlineError(null);
    setOverrideModalOpen(false);
    setOverrideReasonError(null);
    onSubmit(vals);
  });

  // Call onSuccess when booking is successfully created
  useEffect(() => {
    if (submitMessage && onSuccess && !successHandledRef.current) {
      successHandledRef.current = true;
      onSuccess();
    }

    if (!submitMessage) {
      successHandledRef.current = false;
    }
  }, [submitMessage, onSuccess]);

  // Show access denied message if user doesn't have permission
  if (!canCreateBookings) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm">
            You don't have permission to create bookings. Contact your
            administrator if you need access.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Create Booking</h2>
          <p className="text-xs text-slate-300">
            Define a weekly squad block and materialise platform allocations for
            the next few weeks.
          </p>
        </div>
        <span className="text-[10px] rounded-full bg-slate-800 px-2 py-1 text-slate-300">
          Role: {role}
        </span>
      </div>

      <form
        onSubmit={handleSubmitWithCutoff}
        className="grid gap-3 md:grid-cols-3 text-xs"
      >
        {/* Left column: basic details and time */}
        <div className="space-y-2">
          {/* Booking source */}
          <div>
            <label className="block mb-1 font-medium">Booking Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  form.setValue('bookingType', 'catalogue', {
                    shouldValidate: true,
                  })
                }
                disabled={
                  bookingFamilies.length === 0 || bookingSquads.length === 0
                }
                className={clsx(
                  'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition',
                  bookingType === 'catalogue'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-600 text-slate-300 hover:bg-slate-900',
                  (bookingFamilies.length === 0 ||
                    bookingSquads.length === 0) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                Squad Booking
              </button>
              <button
                type="button"
                onClick={() =>
                  form.setValue('bookingType', 'one_off', {
                    shouldValidate: true,
                  })
                }
                disabled={!canCreateOneOff}
                className={clsx(
                  'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition',
                  bookingType === 'one_off'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-600 text-slate-300 hover:bg-slate-900',
                  !canCreateOneOff && 'opacity-50 cursor-not-allowed'
                )}
              >
                One-off Booking
              </button>
            </div>
          </div>

          {bookingType === 'catalogue' ? (
            <>
              <div>
                <label className="block mb-1 font-medium">Family</label>
                <select
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                  value={selectedFamilyId ?? ''}
                  onChange={(e) =>
                    form.setValue(
                      'squadFamilyId',
                      e.target.value ? Number(e.target.value) : null,
                      { shouldValidate: true }
                    )
                  }
                >
                  <option value="">
                    {bookingFamiliesLoading
                      ? 'Loading families...'
                      : 'Select family'}
                  </option>
                  {bookingFamilies.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium">Squad</label>
                <select
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                  value={selectedSquadId ?? ''}
                  onChange={(e) =>
                    form.setValue(
                      'squadId',
                      e.target.value ? Number(e.target.value) : null,
                      { shouldValidate: true }
                    )
                  }
                  disabled={!selectedFamilyId}
                >
                  <option value="">
                    {bookingSquadsLoading
                      ? 'Loading squads...'
                      : selectedFamilyId
                        ? 'Select squad'
                        : 'Select family first'}
                  </option>
                  {filteredSquads.map((squad) => (
                    <option key={squad.id} value={squad.id}>
                      {squad.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block mb-1 font-medium">Booking Name</label>
                <input
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                  {...form.register('oneOffName')}
                  placeholder="Enter booking name"
                />
              </div>
            </>
          )}

          {!canCreateOneOff && (
            <p className="text-[11px] text-amber-300">
              Your role is not allowed to create one-off bookings.
            </p>
          )}

          {(bookingFamilies.length === 0 || bookingSquads.length === 0) &&
            !bookingFamiliesLoading &&
            !bookingSquadsLoading && (
              <p className="text-[11px] text-amber-300">
                No squad catalogue found yet. Using One-off Booking mode.
              </p>
            )}

          <input type="hidden" {...form.register('title')} />

          {/* Side */}
          <div>
            <label className="block mb-1 font-medium">Side</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  form.setValue('sideKey', 'Power', { shouldValidate: true })
                }
                className={clsx(
                  'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition',
                  sideKey === 'Power'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-600 text-slate-300 hover:bg-slate-900'
                )}
              >
                Power
              </button>
              <button
                type="button"
                onClick={() =>
                  form.setValue('sideKey', 'Base', { shouldValidate: true })
                }
                className={clsx(
                  'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition',
                  sideKey === 'Base'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-600 text-slate-300 hover:bg-slate-900'
                )}
              >
                Base
              </button>
            </div>
          </div>

          {/* Time inputs */}
          <BookingTimeInputs
            form={form}
            closedTimes={closedTimes}
            closedPeriods={closedPeriods}
            firstAvailableTime={firstAvailableTime}
            endTimeManuallyChanged={endTimeManuallyChanged}
            onEndTimeChange={() => setEndTimeManuallyChanged(true)}
          />
        </div>

        {/* Middle column: platforms */}
        <div className="space-y-2">
          <BookingPlatformSelection
            form={form}
            sideKey={sideKey}
            weekManagement={weekManagement}
          />

          {/* Capacity validation display */}
          {startDate && startTime && endTime && (
            <CapacityDisplay
              validationResult={capacityValidation}
              proposedCapacity={weekManagement.currentWeekCapacity}
            />
          )}
        </div>

        {/* Right column: areas, lock, submit */}
        <div className="space-y-2">
          {/* Areas */}
          <div>
            <label className="block mb-1 font-medium">
              Areas{' '}
              <span className="text-[10px] text-slate-400">(Coming soon)</span>
            </label>
            <div className="border border-slate-700 rounded-md p-2 max-h-32 overflow-auto bg-slate-950/60 opacity-50 pointer-events-none">
              {areasLoading && (
                <p className="text-slate-400 text-[11px]">Loading areas…</p>
              )}
              {areasError && (
                <p className="text-red-400 text-[11px]">Error: {areasError}</p>
              )}
              {!areasLoading && !areasError && areas.length === 0 && (
                <p className="text-slate-400 text-[11px]">
                  No areas configured.
                </p>
              )}
              {!areasLoading && !areasError && areas.length > 0 && (
                <div className="grid grid-cols-2 gap-1">
                  {areas.map((area) => (
                    <label
                      key={area.id}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400"
                    >
                      <input
                        type="checkbox"
                        value={area.key}
                        disabled
                        className="h-3 w-3 rounded border-slate-600 bg-slate-950 cursor-not-allowed"
                        {...form.register('areas')}
                      />
                      <span>
                        {area.name}{' '}
                        <span className="text-slate-500">({area.key})</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 italic">
              Area selection will be available in a later update
            </p>
          </div>

          {/* Locked booking */}
          {isAdminRole(role) && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isLocked"
                className="h-3 w-3 rounded border-slate-600 bg-slate-950"
                {...form.register('isLocked')}
              />
              <label htmlFor="isLocked" className="text-xs">
                Locked booking (coaches cannot move/modify)
              </label>
            </div>
          )}

          {/* Hard cutoff guidance */}
          {isInsideHardCutoff && (
            <div className="space-y-2">
              <div className="text-[11px] text-amber-200 bg-amber-900/20 border border-amber-700/40 rounded-md p-2">
                Bookings must be made at least {cutoffHours} hours in advance.
                If you are inside the cutoff window, please ask the on-site team
                to handle it. Admins can proceed only when it is truly necessary
                and must record a reason.
              </div>
            </div>
          )}

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                submitting ||
                (!capacityValidation.isValid &&
                  !capacityValidation.isLoading) ||
                (isInsideHardCutoff && !isAdminRole(role))
              }
              className={clsx(
                'w-full inline-flex items-center justify-center rounded-md py-1.5 text-xs font-medium',
                'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed',
                !capacityValidation.isValid &&
                  !capacityValidation.isLoading &&
                  'bg-red-600 hover:bg-red-500'
              )}
            >
              {submitting
                ? 'Creating booking...'
                : !capacityValidation.isValid && !capacityValidation.isLoading
                  ? 'Cannot create: Capacity exceeded'
                  : 'Create booking'}
            </button>
          </div>

          {/* Messages */}
          {submitMessage && (
            <p className="text-[11px] text-emerald-400 mt-1">{submitMessage}</p>
          )}
          {(inlineError || submitError) && (
            <div className="mt-2 p-3 bg-red-900/20 border border-red-700/50 rounded-md">
              <p className="text-sm text-red-300 font-medium mb-1">Error</p>
              <pre className="text-xs text-red-400 whitespace-pre-wrap font-sans">
                {inlineError || submitError}
              </pre>
            </div>
          )}
        </div>
      </form>

      {/* Emergency reason modal (admin inside cutoff) */}
      {overrideModalOpen && isAdminRole(role) && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 w-full max-w-lg space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">
                Confirm emergency booking
              </h3>
              <p className="text-xs text-slate-300">
                This booking is inside the {cutoffHours}-hour cutoff. Please
                record why this needs to proceed now.
              </p>
              <textarea
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                rows={4}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for booking inside the cutoff window"
              />
              {overrideReasonError && (
                <p className="text-xs text-red-400">{overrideReasonError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700"
                  onClick={() => {
                    setOverrideModalOpen(false);
                    setOverrideReason('');
                    setOverrideReasonError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
                  onClick={() => {
                    const reason = overrideReason.trim();
                    if (!reason) {
                      setOverrideReasonError(
                        'Please provide a reason to proceed.'
                      );
                      return;
                    }
                    form.setValue('emergencyReason', reason, {
                      shouldValidate: false,
                    });
                    setOverrideReasonError(null);
                    setOverrideModalOpen(false);
                    handleSubmitWithCutoff();
                  }}
                >
                  Confirm booking
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
