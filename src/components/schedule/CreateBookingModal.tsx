import { useMemo } from "react";
import { format } from "date-fns";
import { Modal } from "../shared/Modal";
import { BookingFormPanel } from "../admin/BookingFormPanel";
import { formatTimeSlot, type TimeSlot } from "../admin/capacity/scheduleUtils";
import type { BookingFormValues } from "../../schemas/bookingForm";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialDate: Date;
  initialTimeSlot: TimeSlot;
  initialRack: number;
  initialSide: "Power" | "Base";
  role: "admin" | "coach";
  onSuccess?: () => void;
};

/**
 * Modal for creating a new booking from the Schedule page.
 * Pre-fills the form with the clicked cell's date, time, rack, and side.
 */
export function CreateBookingModal({
  isOpen,
  onClose,
  initialDate,
  initialTimeSlot,
  initialRack,
  initialSide,
  role,
  onSuccess,
}: Props) {
  // Calculate values for display and form
  const dateStr = format(initialDate, "yyyy-MM-dd");
  const timeStr = formatTimeSlot(initialTimeSlot);
  
  // Calculate end time (default to 1.5 hours after start)
  const endHour = initialTimeSlot.hour;
  const endMinute = initialTimeSlot.minute + 30;
  const adjustedEndHour = endMinute >= 60 ? endHour + 1 : endHour;
  const adjustedEndMinute = endMinute >= 60 ? endMinute - 60 : endMinute;
  const endTimeStr = `${String(adjustedEndHour).padStart(2, "0")}:${String(adjustedEndMinute).padStart(2, "0")}`;

  // Calculate initial form values
  const initialFormValues = useMemo<Partial<BookingFormValues>>(() => {
    return {
      sideKey: initialSide,
      startDate: dateStr,
      startTime: timeStr,
      endTime: endTimeStr,
      racksInput: String(initialRack),
    };
  }, [initialDate, initialTimeSlot, initialRack, initialSide, dateStr, timeStr, endTimeStr]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="5xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Create New Booking</h2>
            <p className="text-sm text-slate-400 mt-1">
              Pre-filled for {format(initialDate, "EEEE, MMMM d")} at {timeStr} on Rack {initialRack} ({initialSide})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <BookingFormPanel 
          role={role} 
          initialValues={initialFormValues}
          onSuccess={() => {
            onSuccess?.();
            onClose();
          }}
        />
      </div>
    </Modal>
  );
}

