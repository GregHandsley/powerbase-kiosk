import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { RackRow } from '../RackListEditorCore';
import type { ActiveInstance } from '../../../types/snapshot';
import clsx from 'clsx';

/** Tooltip content and styling matching the home screen hover tooltip */
const OPEN_PLATFORM_TOOLTIP_LINE = 'Open platform without a rack';
const HOME_TOOLTIP_CLASS =
  'pointer-events-none fixed z-[200] min-w-[160px] rounded-md border border-indigo-300/70 bg-slate-950 px-2.5 py-1.5 text-[10px] text-slate-100 shadow-[0_10px_24px_rgba(2,6,23,0.85)] ring-1 ring-indigo-400/30';

type Props = {
  row: RackRow;
  booking: ActiveInstance | null;
  isSelected?: boolean;
  isDisabled?: boolean;
  isClickable?: boolean;
  hasConflict?: boolean;
  onClick?: () => void;
  /** Size variant - 'full' for live view, 'mini' for compact view */
  variant?: 'full' | 'mini';
  /** Reason why the platform is unavailable - for display purposes */
  unavailableReason?: 'booked' | 'not-in-schedule' | 'partially-booked' | null;
};

/**
 * Shared component for rendering a rack cell.
 * Can be styled differently for full live view or mini compact view.
 */
export function RackCell({
  row,
  // booking,
  isSelected = false,
  isDisabled = false,
  isClickable = false,
  hasConflict = false,
  onClick,
  variant = 'full',
  unavailableReason = null,
}: Props) {
  const [openPlatformTooltip, setOpenPlatformTooltip] = useState<{
    show: boolean;
    x: number;
    y: number;
  } | null>(null);

  const handleOpenPlatformIconEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!row.isOpenPlatform) return;
      e.stopPropagation();
      setOpenPlatformTooltip({
        show: true,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [row.isOpenPlatform]
  );

  const handleOpenPlatformIconMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!row.isOpenPlatform || !openPlatformTooltip?.show) return;
      setOpenPlatformTooltip((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY } : null
      );
    },
    [row.isOpenPlatform, openPlatformTooltip?.show]
  );

  const handleOpenPlatformIconLeave = useCallback(() => {
    setOpenPlatformTooltip(null);
  }, []);

  const handleClick = () => {
    if (isClickable && onClick) {
      onClick();
    }
  };

  const borderColor = hasConflict
    ? 'border-red-500'
    : isSelected
      ? 'border-indigo-500'
      : unavailableReason === 'partially-booked'
        ? 'border-amber-500/70'
        : isDisabled
          ? 'border-slate-600'
          : 'border-slate-700';

  const backgroundColor = hasConflict
    ? variant === 'mini'
      ? 'bg-red-900/40'
      : 'bg-red-900/30'
    : isSelected
      ? variant === 'mini'
        ? 'bg-indigo-900/30'
        : 'bg-indigo-600/20'
      : unavailableReason === 'partially-booked'
        ? variant === 'mini'
          ? 'bg-amber-900/25'
          : 'bg-amber-900/20'
        : isDisabled
          ? variant === 'mini'
            ? 'bg-slate-800/50'
            : 'bg-slate-900/40 opacity-50'
          : variant === 'mini'
            ? 'bg-slate-800/30'
            : 'bg-slate-900/80';

  if (variant === 'mini') {
    return (
      <div
        onClick={handleClick}
        style={{
          gridColumn: row.gridColumn,
          gridRow: row.gridRow,
        }}
        className={clsx(
          'flex flex-col items-center justify-center rounded border px-1 py-1 transition text-[10px] leading-tight',
          borderColor,
          backgroundColor,
          isClickable ? 'cursor-pointer hover:bg-slate-700/50' : '',
          isDisabled ? 'cursor-not-allowed opacity-50' : '',
          row.disabled ? 'text-slate-600' : 'text-slate-100'
        )}
      >
        <span className="font-semibold text-[10px] flex items-center justify-center gap-0.5">
          {row.label}
          {row.isOpenPlatform && (
            <span
              className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-slate-600/80 text-slate-300 text-[8px] font-normal flex-shrink-0"
              aria-label="Open platform without a rack"
              onMouseEnter={handleOpenPlatformIconEnter}
              onMouseMove={handleOpenPlatformIconMove}
              onMouseLeave={handleOpenPlatformIconLeave}
            >
              i
            </span>
          )}
        </span>
        {openPlatformTooltip?.show &&
          createPortal(
            <div
              className={HOME_TOOLTIP_CLASS}
              style={{
                left: openPlatformTooltip.x + 12,
                top: openPlatformTooltip.y - 12,
                transform: 'translateY(-100%)',
              }}
            >
              <div className="font-semibold">{OPEN_PLATFORM_TOOLTIP_LINE}</div>
            </div>,
            document.body
          )}
        {!row.disabled &&
          (isDisabled || unavailableReason === 'partially-booked') && (
            <span
              className={clsx(
                'text-[8px] mt-0.5 leading-none',
                unavailableReason === 'partially-booked'
                  ? 'text-amber-400'
                  : 'text-slate-400'
              )}
            >
              {unavailableReason === 'partially-booked'
                ? 'Partially booked'
                : unavailableReason === 'booked'
                  ? 'Booked'
                  : unavailableReason === 'not-in-schedule'
                    ? 'Unavailable'
                    : 'Unavailable'}
            </span>
          )}
      </div>
    );
  }

  // Full variant - this would be used by RackRowDroppable, but keeping the interface consistent
  // The full variant is actually handled by RackRowDroppable, so this is mainly for mini
  return null;
}
