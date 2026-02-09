import clsx from 'clsx';
import type { BookingStatus } from '../../types/db';

type Props = {
  status: BookingStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isPast?: boolean;
  isUnprocessedPast?: boolean;
};

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bgColor: string; textColor: string; borderColor?: string }
> = {
  draft: {
    label: 'Draft',
    bgColor: 'bg-slate-700/50',
    textColor: 'text-slate-300',
    borderColor: 'border-slate-600',
  },
  pending: {
    label: 'Pending',
    bgColor: 'bg-yellow-900/30',
    textColor: 'text-yellow-300',
    borderColor: 'border-yellow-600/50',
  },
  processed: {
    label: 'Processed',
    bgColor: 'bg-blue-900/30',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-600/50',
  },
  confirmed: {
    label: 'Confirmed',
    bgColor: 'bg-green-900/30',
    textColor: 'text-green-300',
    borderColor: 'border-green-600/50',
  },
  completed: {
    label: 'Completed',
    bgColor: 'bg-slate-800/50',
    textColor: 'text-slate-400',
    borderColor: 'border-slate-600',
  },
  pending_cancellation: {
    label: 'Pending Cancellation',
    bgColor: 'bg-orange-900/30',
    textColor: 'text-orange-300',
    borderColor: 'border-orange-600/50',
  },
  cancelled: {
    label: 'Cancelled',
    bgColor: 'bg-red-900/30',
    textColor: 'text-red-300',
    borderColor: 'border-red-600/50',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function StatusBadge({
  status,
  size = 'md',
  className,
  isPast = false,
  isUnprocessedPast = false,
}: Props) {
  const config = STATUS_CONFIG[status];

  // Override styling for unprocessed past bookings (high priority warning)
  const bgColor = isUnprocessedPast
    ? 'bg-red-900/40'
    : isPast
      ? 'bg-slate-900/60'
      : config.bgColor;
  const textColor = isUnprocessedPast
    ? 'text-red-200'
    : isPast
      ? 'text-slate-400'
      : config.textColor;
  const borderColor = isUnprocessedPast
    ? 'border-red-600/70'
    : isPast
      ? 'border-slate-600/70'
      : config.borderColor;

  const label = isUnprocessedPast
    ? `${config.label} (Past - Unprocessed)`
    : isPast
      ? `${config.label} (Past)`
      : config.label;

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded border',
        bgColor,
        textColor,
        borderColor,
        SIZE_CLASSES[size],
        className
      )}
      title={`Status: ${label}`}
    >
      {config.label}
    </span>
  );
}
