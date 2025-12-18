import { formatTimeForInput } from "../shared/dateUtils";
import { useAuth } from "../../context/AuthContext";
import type { ActiveInstance } from "../../types/snapshot";
import { Modal } from "../shared/Modal";
import { BookingEditorHeader } from "./booking-editor/BookingEditorHeader";
import { TimeInputSection } from "./booking-editor/TimeInputSection";
import { SeriesInstancesList } from "./booking-editor/SeriesInstancesList";
import { ExtendBookingDialog } from "./booking-editor/ExtendBookingDialog";
import { DeleteConfirmationDialog } from "./booking-editor/DeleteConfirmationDialog";
import { BookingEditorActions } from "./booking-editor/BookingEditorActions";
import { useBookingEditor } from "./booking-editor/useBookingEditor";

type Props = {
  booking: ActiveInstance | null;
  isOpen: boolean;
  onClose: () => void;
  onClearRacks: (selectedInstances?: Set<number>) => void;
  onSaveTime?: (startTime: string, endTime: string) => Promise<void>;
  initialSelectedInstances?: Set<number>;
};

/**
 * Modal for editing booking time and clearing rack selection.
 */
export function BookingEditorModal({
  booking,
  isOpen,
  onClose,
  onClearRacks,
  onSaveTime,
  initialSelectedInstances,
}: Props) {
  const { role } = useAuth();

  const {
    startTime,
    endTime,
    saving,
    error,
    showDeleteConfirm,
    deleting,
    selectedInstances,
    applyToAll,
    currentWeekIndex,
    showExtendDialog,
    extendWeeks,
    extending,
    seriesInstances,
    hasTimeChanges,
    setStartTime,
    setEndTime,
    setError,
    setShowDeleteConfirm,
    setApplyToAll,
    setCurrentWeekIndex,
    setShowExtendDialog,
    setExtendWeeks,
    handleSaveTime,
    handleDeleteSelected,
    handleDeleteSeries,
    handleExtendBooking,
    handleInstanceToggle,
  } = useBookingEditor(booking, isOpen, initialSelectedInstances);

  if (!isOpen || !booking) return null;

  const isLocked = booking.isLocked && role !== "admin";

  const handleCancel = () => {
    if (booking) {
      setStartTime(formatTimeForInput(booking.start));
      setEndTime(formatTimeForInput(booking.end));
    }
    setError(null);
    onClose();
  };

  const handleClearRacks = () => {
    onClearRacks(selectedInstances);
  };

  const handleSave = async () => {
    if (!hasTimeChanges) {
      onClose();
      return;
    }
    const success = await handleSaveTime();
    if (success) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel}>
      <div className="space-y-4">
        <BookingEditorHeader title={booking.title} isLocked={isLocked} />

        <TimeInputSection
          startTime={startTime}
          endTime={endTime}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          disabled={isLocked || saving}
        />

        <SeriesInstancesList
          instances={seriesInstances}
          selectedInstances={selectedInstances}
          currentInstanceId={booking.instanceId}
          onInstanceToggle={handleInstanceToggle}
          applyToAll={applyToAll}
          onApplyToAllChange={setApplyToAll}
          currentWeekIndex={currentWeekIndex}
          onWeekIndexChange={setCurrentWeekIndex}
          disabled={isLocked || saving || deleting}
        />

        {error && (
          <div className="rounded-md bg-red-900/20 border border-red-700/50 p-3">
            <p className="text-sm text-red-400">{error}</p>
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

        <DeleteConfirmationDialog
          isOpen={showDeleteConfirm !== null}
          type={showDeleteConfirm ?? "selected"}
          selectedInstances={selectedInstances}
          seriesInstances={seriesInstances}
          onCancel={() => setShowDeleteConfirm(null)}
          onConfirm={async () => {
            const success =
              showDeleteConfirm === "selected"
                ? await handleDeleteSelected()
                : await handleDeleteSeries();
            if (success) {
              onClose();
            }
          }}
          deleting={deleting}
          disabled={isLocked}
        />

        <BookingEditorActions
          onEditRacks={handleClearRacks}
          onCancel={handleCancel}
          onSave={handleSave}
          onDeleteSelected={() => setShowDeleteConfirm("selected")}
          onDeleteSeries={() => setShowDeleteConfirm("series")}
          onExtend={() => setShowExtendDialog(true)}
          saving={saving}
          deleting={deleting}
          hasTimeChanges={hasTimeChanges}
          selectedInstancesCount={selectedInstances.size}
          seriesInstancesCount={seriesInstances.length}
          showDeleteConfirm={showDeleteConfirm !== null}
          showExtendDialog={showExtendDialog}
          isLocked={isLocked}
        />
      </div>
    </Modal>
  );
}
