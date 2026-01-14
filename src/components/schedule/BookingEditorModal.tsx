import { useEffect } from 'react';
import { formatTimeForInput } from '../shared/dateUtils';
import { useAuth } from '../../context/AuthContext';
import type { ActiveInstance } from '../../types/snapshot';
import { Modal } from '../shared/Modal';
import { BookingEditorHeader } from './booking-editor/BookingEditorHeader';
import { TimeInputSection } from './booking-editor/TimeInputSection';
import { SeriesInstancesList } from './booking-editor/SeriesInstancesList';
import { ExtendBookingDialog } from './booking-editor/ExtendBookingDialog';
import { CancelBookingDialog } from './booking-editor/CancelBookingDialog';
import { UpdateTimeConfirmationDialog } from './booking-editor/UpdateTimeConfirmationDialog';
import { BookingEditorActions } from './booking-editor/BookingEditorActions';
import { useBookingEditor } from './booking-editor/useBookingEditor';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useClosedTimes } from '../admin/capacity/useClosedTimes';
import { format } from 'date-fns';
import { canEditBooking } from '../../utils/bookingPermissions';

type Props = {
  booking: ActiveInstance | null;
  isOpen: boolean;
  onClose: () => void;
  onClearRacks: (selectedInstances?: Set<number>) => void;
  onSaveTime?: (startTime: string, endTime: string) => Promise<void>;
  initialSelectedInstances?: Set<number>;
  /** When true, open directly into the extend dialog (used by MyBookings Extend) */
  initialShowExtendDialog?: boolean;
};

/**
 * Modal for editing booking time and clearing rack selection.
 */
export function BookingEditorModal({
  booking,
  isOpen,
  onClose,
  onClearRacks,
  // onSaveTime,
  initialSelectedInstances,
  initialShowExtendDialog = false,
}: Props) {
  const { user, role } = useAuth();

  const {
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
    setStartTime,
    setEndTime,
    setCapacity,
    setError,
    setShowCancelDialog,
    setCancelMode,
    setApplyToAll,
    setCurrentWeekIndex,
    setShowExtendDialog,
    setExtendWeeks,
    setShowUpdateTimeConfirm,
    handleSaveTime,
    performUpdate,
    handleCancelBooking,
    handleExtendBooking,
    handleInstanceToggle,
  } = useBookingEditor(booking, isOpen, initialSelectedInstances);

  // Open directly into the extend dialog when requested (e.g., Extend from MyBookings)
  useEffect(() => {
    if (isOpen && initialShowExtendDialog) {
      setShowExtendDialog(true);
      setShowUpdateTimeConfirm(false);
    }
  }, [
    isOpen,
    initialShowExtendDialog,
    setShowExtendDialog,
    setShowUpdateTimeConfirm,
  ]);

  // Fetch the booking's side_id to get closed times
  const { data: bookingSideId } = useQuery({
    queryKey: ['booking-side-id', booking?.instanceId],
    queryFn: async () => {
      if (!booking) return null;

      const { data, error } = await supabase
        .from('booking_instances')
        .select('side_id')
        .eq('id', booking.instanceId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching booking side_id:', error);
        return null;
      }

      return data?.side_id ?? null;
    },
    enabled: !!booking && isOpen,
  });

  // Get the date from the booking's start time
  const bookingDate = booking
    ? format(new Date(booking.start), 'yyyy-MM-dd')
    : null;

  // Get closed times for the booking's date and side
  const { closedTimes, closedPeriods } = useClosedTimes(
    bookingSideId ?? null,
    bookingDate
  );

  if (!isOpen || !booking) return null;

  // Check if booking is cancelled
  const isCancelled =
    booking.status === 'cancelled' || booking.status === 'pending_cancellation';

  // Check if user has permission to edit this booking
  const canEdit =
    !isCancelled && canEditBooking(booking, user?.id || null, role);
  const isLocked = booking.isLocked && role !== 'admin';

  const handleCancel = () => {
    if (booking) {
      setStartTime(formatTimeForInput(booking.start));
      setEndTime(formatTimeForInput(booking.end));
      setCapacity(booking.capacity || 1);
    }
    setError(null);
    onClose();
  };

  const handleClearRacks = () => {
    onClearRacks(selectedInstances);
  };

  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }
    // handleSaveTime will show confirmation if needed, or proceed directly
    const success = await handleSaveTime();
    if (success) {
      onClose();
    }
  };

  const handleConfirmUpdateTime = async () => {
    const success = await performUpdate();
    if (success) {
      setShowUpdateTimeConfirm(false);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel}>
      <div className="space-y-4">
        <BookingEditorHeader
          title={booking.title}
          isLocked={isLocked}
          mode={canEdit ? 'edit' : 'view'}
        />

        {isCancelled && (
          <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-md text-sm text-red-200">
            This booking has been cancelled and cannot be edited.
          </div>
        )}
        {!canEdit && !isCancelled && (
          <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-md text-sm text-amber-200">
            You don't have permission to edit this booking. Only the coach who
            created it or an admin can edit it.
          </div>
        )}

        <TimeInputSection
          startTime={startTime}
          endTime={endTime}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          disabled={!canEdit || isLocked || saving}
          closedTimes={closedTimes}
          closedPeriods={closedPeriods}
        />

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Number of Athletes
            {applyToAll ? (
              <span className="ml-2 text-xs text-slate-400 font-normal">
                (applies to all {seriesInstances.length} sessions)
              </span>
            ) : (
              <span className="ml-2 text-xs text-slate-400 font-normal">
                (for selected sessions in current week)
              </span>
            )}
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={capacity}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value) && value >= 1 && value <= 100) {
                setCapacity(value);
                // Mark that user manually changed capacity (handled in useBookingEditor)
              }
            }}
            disabled={!canEdit || isLocked || saving}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <SeriesInstancesList
          instances={seriesInstances}
          selectedInstances={selectedInstances}
          currentInstanceId={booking.instanceId}
          onInstanceToggle={handleInstanceToggle}
          applyToAll={applyToAll}
          onApplyToAllChange={setApplyToAll}
          currentWeekIndex={currentWeekIndex}
          onWeekIndexChange={setCurrentWeekIndex}
          disabled={isLocked || saving || cancelling}
          showCapacity={!applyToAll}
        />

        {error && (
          <div className="rounded-md bg-red-900/20 border border-red-700/50 p-3">
            <pre className="text-sm text-red-400 whitespace-pre-wrap font-sans">
              {error}
            </pre>
          </div>
        )}

        <ExtendBookingDialog
          isOpen={showExtendDialog}
          extendWeeks={extendWeeks}
          onExtendWeeksChange={setExtendWeeks}
          onCancel={() => {
            setShowExtendDialog(false);
            setExtendWeeks(1);
            setError(null);
          }}
          onConfirm={async () => {
            const success = await handleExtendBooking();
            if (success) {
              onClose();
            }
          }}
          seriesInstances={seriesInstances}
          extending={extending}
          disabled={isLocked}
        />

        <UpdateTimeConfirmationDialog
          isOpen={showUpdateTimeConfirm && !showExtendDialog && hasChanges}
          sessionCount={selectedInstances.size}
          startTime={hasTimeChanges ? startTime : ''}
          endTime={hasTimeChanges ? endTime : ''}
          capacity={hasCapacityChanges ? capacity : undefined}
          onCancel={() => setShowUpdateTimeConfirm(false)}
          onConfirm={handleConfirmUpdateTime}
          saving={saving}
          disabled={isLocked}
        />

        <CancelBookingDialog
          isOpen={showCancelDialog}
          selectedDate={booking ? new Date(booking.start) : null}
          bookingInfo={
            booking
              ? {
                  title: booking.title,
                  bookingId: booking.bookingId,
                  hasRecurrence: seriesInstances.length > 1,
                }
              : null
          }
          cancelMode={cancelMode}
          onCancelModeChange={setCancelMode}
          onCancel={() => setShowCancelDialog(false)}
          onConfirm={async () => {
            const success = await handleCancelBooking();
            if (success) {
              onClose();
            }
          }}
          cancelling={cancelling}
        />

        <BookingEditorActions
          onEditRacks={canEdit ? handleClearRacks : undefined}
          onCancel={handleCancel}
          onSave={canEdit ? handleSave : undefined}
          onCancelBooking={
            canEdit
              ? () => {
                  setShowCancelDialog(true);
                  setCancelMode('single');
                }
              : undefined
          }
          onExtend={
            canEdit
              ? () => {
                  setShowExtendDialog(true);
                  setShowUpdateTimeConfirm(false); // Hide update confirmation when extending
                }
              : undefined
          }
          saving={saving}
          cancelling={cancelling}
          hasChanges={hasChanges}
          selectedInstancesCount={selectedInstances.size}
          seriesInstancesCount={seriesInstances.length}
          showCancelDialog={showCancelDialog}
          showExtendDialog={showExtendDialog}
          isLocked={isLocked || !canEdit}
        />
      </div>
    </Modal>
  );
}
