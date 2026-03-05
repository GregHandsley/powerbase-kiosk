import clsx from 'clsx';
import { STEP_TIME, STEP_EQUIPMENT, STEP_REVIEW } from './constants';

type Props = {
  step: number;
};

export function CreateBookingFlowStepIndicator({ step }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-800/80 p-1">
      <span
        className={clsx(
          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          step === STEP_TIME
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400'
        )}
      >
        Step 1: Time
      </span>
      <span
        className={clsx(
          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          step === STEP_EQUIPMENT
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400'
        )}
      >
        Step 2: Equipment & areas
      </span>
      <span
        className={clsx(
          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          step === STEP_REVIEW
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-400'
        )}
      >
        Step 3: Review & confirm
      </span>
    </div>
  );
}
