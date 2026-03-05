import { STEP_TIME, STEP_EQUIPMENT, STEP_REVIEW } from './constants';

type Props = {
  step: number;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  canGoToEquipment: boolean;
  hasAnyRacksOrAreas: boolean;
  setStep: (s: number) => void;
  formErrors: {
    racksInput?: { message?: string };
    areaSlots?: { message?: string };
  };
  setFormError: (field: 'racksInput' | 'areaSlots', message: string) => void;
  reviewConflictsCount: number;
  reviewConflictsLoading: boolean;
  capacityValid: boolean;
  submitting: boolean;
  onConfirmCreate: () => void;
};

export function CreateBookingFlowFooter({
  step,
  onClose,
  onBack,
  onNext,
  canGoToEquipment,
  hasAnyRacksOrAreas,
  setStep,
  formErrors,
  setFormError,
  reviewConflictsCount,
  reviewConflictsLoading,
  capacityValid,
  submitting,
  onConfirmCreate,
}: Props) {
  return (
    <div className="flex-shrink-0 border-t border-slate-700/80 bg-slate-900/80 px-6 pt-5">
      {step === STEP_TIME && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoToEquipment}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Next: Equipment & areas
          </button>
        </div>
      )}
      {step === STEP_EQUIPMENT && (
        <div className="flex justify-between items-center gap-3">
          <div className="min-h-[1.5rem] flex items-center flex-1">
            {(formErrors.racksInput || formErrors.areaSlots) && (
              <p className="text-sm text-amber-400">
                Add at least one area or platform to create a booking.
              </p>
            )}
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-500 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (!hasAnyRacksOrAreas) {
                  setFormError(
                    'racksInput',
                    'Add at least one area or platform to create a booking.'
                  );
                  return;
                }
                setStep(STEP_REVIEW);
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              Next: Review & confirm
            </button>
          </div>
        </div>
      )}
      {step === STEP_REVIEW && (
        <div className="flex justify-between items-center gap-3">
          <div className="min-h-[1.5rem] flex items-center flex-1">
            {reviewConflictsCount > 0 && (
              <p className="text-sm text-amber-400">
                Resolve conflicts above before creating the booking.
              </p>
            )}
            {!capacityValid && reviewConflictsCount === 0 && (
              <p className="text-sm text-amber-400">
                Reduce capacity or adjust times to fix violations.
              </p>
            )}
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-500 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              disabled={
                reviewConflictsLoading ||
                reviewConflictsCount > 0 ||
                !capacityValid ||
                submitting
              }
              onClick={onConfirmCreate}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? 'Creating...' : 'Create booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
