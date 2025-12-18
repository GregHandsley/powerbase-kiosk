type BookingEditorHeaderProps = {
  title: string;
  isLocked: boolean;
};

/**
 * Header component for booking editor modal
 */
export function BookingEditorHeader({
  title,
  isLocked,
}: BookingEditorHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Edit Booking</h2>
        <p className="text-xs text-slate-500 mt-1">{title}</p>
      </div>
      {isLocked && (
        <span className="text-xs rounded-full bg-slate-800 px-2 py-1 text-slate-400 flex items-center gap-1">
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-label="Locked"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          Locked
        </span>
      )}
    </div>
  );
}

