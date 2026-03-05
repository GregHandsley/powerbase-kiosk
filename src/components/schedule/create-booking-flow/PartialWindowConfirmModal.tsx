import { Modal } from '../../shared/Modal';
import type { BookingFormValues } from '../../../schemas/bookingForm';

type Props = {
  values: BookingFormValues | null;
  onClose: () => void;
  onSubmit: (values: BookingFormValues) => void;
  submitting: boolean;
};

export function PartialWindowConfirmModal({
  values,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  if (!values) return null;

  return (
    <Modal isOpen onClose={onClose} maxWidth="sm" overlayClassName="z-[1100]">
      <div className="space-y-4">
        <p className="text-slate-200">
          Some items don&apos;t cover the full booking time ({values.startTime}–
          {values.endTime}). Create the booking anyway?
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(values)}
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting ? 'Creating...' : 'Create booking'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
