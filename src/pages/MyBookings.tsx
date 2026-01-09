import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useMyBookings, type BookingFilter } from "../hooks/useMyBookings";
import { BookingCard } from "../components/my-bookings/BookingCard";
import { BookingFilters } from "../components/my-bookings/BookingFilters";
import { BookingEditorModal } from "../components/schedule/BookingEditorModal";
import { RackSelectionPanel } from "../components/schedule/rack-editor/RackSelectionPanel";
import { MiniScheduleFloorplan } from "../components/shared/MiniScheduleFloorplan";
import { UpdateRacksConfirmationDialog } from "../components/schedule/booking-editor/UpdateRacksConfirmationDialog";
import { useRackSelection } from "../components/schedule/rack-editor/useRackSelection";
import { useQueryClient } from "@tanstack/react-query";
import type { ActiveInstance } from "../types/snapshot";
import type { BookingWithInstances } from "../hooks/useMyBookings";
import { canEditBooking } from "../utils/bookingPermissions";

export function MyBookings() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<BookingFilter>({
    status: "all",
    side: "all",
  });
  const [editingBooking, setEditingBooking] = useState<ActiveInstance | null>(null);
  const [showExtendDialogOnOpen, setShowExtendDialogOnOpen] = useState(false);

  const { data: bookings = [], isLoading, error } = useMyBookings(user?.id || null, filters);

  const {
    isSelectingRacks,
    selectedRacks,
    savingRacks,
    applyRacksToAll,
    setApplyRacksToAll,
    rackValidationError,
    seriesInstancesForRacks,
    weeksForRacks,
    rackSelectionWeekIndex,
    setRackSelectionWeekIndex,
    currentWeekInstancesForRacks,
    selectedInstancesForRacks,
    setSelectedInstancesForRacks,
    currentWeekTimeRange,
    bookingSide,
    savedSelectedInstances,
    showUpdateRacksConfirm,
    setShowUpdateRacksConfirm,
    setSelectedRacks,
    setRackValidationError,
    startRackSelection: handleEditRacksRacks,
    handleCancelRackSelection,
    handleSaveRacks,
    performRackUpdate,
    handleRackClick,
    enteringSelectionModeRef,
  } = useRackSelection({
    editingBooking,
    setEditingBooking,
    onAfterRackUpdate: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      await queryClient.invalidateQueries({ queryKey: ["booking-series"] });
    },
  });

  const convertToActiveInstance = (booking: BookingWithInstances): ActiveInstance | null => {
    const firstInstance = booking.instances[0];
    if (!firstInstance) return null;
    return {
      instanceId: firstInstance.id,
      bookingId: booking.id,
      start: firstInstance.start,
      end: firstInstance.end,
      racks: firstInstance.racks,
      areas: firstInstance.areas,
      title: booking.title,
      color: booking.color,
      isLocked: booking.is_locked,
      createdBy: booking.created_by,
      capacity: firstInstance.capacity,
      status: booking.status,
    };
  };

  const handleEdit = (booking: BookingWithInstances) => {
    const activeInstance = convertToActiveInstance(booking);
    if (!activeInstance) return;
    
    // Check if user has permission to edit this booking
    if (!canEditBooking(activeInstance, user?.id || null, role)) {
      // This shouldn't happen in MyBookings since it only shows user's bookings,
      // but check anyway for safety
      alert("You don't have permission to edit this booking.");
      return;
    }
    
    setShowExtendDialogOnOpen(false);
    setEditingBooking(activeInstance);
  };


  const handleBookingModalClose = () => {
    if (!isSelectingRacks && !enteringSelectionModeRef.current) {
      setEditingBooking(null);
    } else {
      enteringSelectionModeRef.current = false;
    }
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    setShowExtendDialogOnOpen(false);
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-slate-400">Please log in to view your bookings.</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {isSelectingRacks && editingBooking ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Edit Racks</h1>
              <p className="text-slate-400 text-sm">
                Choose the platforms for your booking. This matches the Schedule flow.
              </p>
            </div>
          </div>

          <RackSelectionPanel
            editingBooking={editingBooking}
            selectedRacks={selectedRacks}
            rackValidationError={rackValidationError}
            savingRacks={savingRacks}
            applyRacksToAll={applyRacksToAll}
            setApplyRacksToAll={(value) => {
              setApplyRacksToAll(value);
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

          {currentWeekTimeRange && bookingSide && (
            <div className="border border-slate-700 rounded-lg bg-slate-900/60 p-4">
              <MiniScheduleFloorplan
                sideKey={bookingSide}
                selectedRacks={selectedRacks}
                onRackClick={(rackNumber, replaceSelection = false) => {
                  if (replaceSelection) {
                    setSelectedRacks([rackNumber]);
                    setRackValidationError(null);
                    return;
                  }
                  handleRackClick(rackNumber);
                }}
                startTime={currentWeekTimeRange.start}
                endTime={currentWeekTimeRange.end}
                showTitle={true}
                allowConflictingRacks={false}
                ignoreBookings={false}
                excludeInstanceIds={new Set(seriesInstancesForRacks.map((inst) => inst.id))}
              />
            </div>
          )}
          {currentWeekTimeRange && !bookingSide && (
            <div className="text-sm text-slate-400">Loading layout for this side...</div>
          )}

          <UpdateRacksConfirmationDialog
            isOpen={showUpdateRacksConfirm}
            sessionCount={selectedInstancesForRacks.size}
            racks={selectedRacks}
            onCancel={() => setShowUpdateRacksConfirm(false)}
            onConfirm={performRackUpdate}
            saving={savingRacks}
          />
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">My Bookings</h1>
            <p className="text-slate-400">
              View and manage all your bookings. Filter by status, date, or side.
            </p>
          </div>

          <BookingFilters filters={filters} onFiltersChange={setFilters} />

          {isLoading && (
            <div className="text-center py-12 text-slate-400">Loading your bookings...</div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-300">
              Error loading bookings: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

          {!isLoading && !error && bookings.length === 0 && (
            <div className="text-center py-12">
              <div className="text-slate-400 mb-4">No bookings found.</div>
              <a
                href="/schedule"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Create your first booking →
              </a>
            </div>
          )}

          {!isLoading && !error && bookings.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm text-slate-400 mb-4">
                Showing {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
              </div>
              {bookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Booking Editor Modal */}
      {editingBooking && (
        <BookingEditorModal
          booking={editingBooking}
          isOpen={!!editingBooking && !isSelectingRacks}
          onClose={handleBookingModalClose}
          onClearRacks={handleEditRacksRacks}
          onSaveTime={() => {}}
          initialSelectedInstances={
            savedSelectedInstances.size > 0 ? savedSelectedInstances : undefined
          }
          initialShowExtendDialog={showExtendDialogOnOpen}
        />
      )}

    </div>
  );
}

