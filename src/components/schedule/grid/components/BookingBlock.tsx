import { format } from 'date-fns';
import type { BookingBlock as BookingBlockType } from '../types';
import type { BookingStatus } from '../../../../types/db';

type Props = {
  block: BookingBlockType;
  onClick?: (booking: BookingBlockType['booking']) => void;
  /** In master view: double-click opens read-only view; single-click does nothing. */
  onDoubleClick?: (booking: BookingBlockType['booking']) => void;
  /** When true, block is view-only (no edit on click); use with onDoubleClick for view modal. */
  viewOnly?: boolean;
  /** When multiple blocks start at the same slot, stack them vertically. */
  stackOffsetPx?: number;
  /** Override rowSpan height so stacked blocks fit in the same slot range. */
  rowSpanOverride?: number;
};

function getPendingChangeTag(
  status: BookingStatus | undefined
): { label: string; className: string; indicatorClassName: string } | null {
  switch (status) {
    case 'pending_cancellation':
      return {
        label: 'Cancel due',
        className:
          'bg-amber-400/20 text-amber-100 border border-amber-300/50 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]',
        indicatorClassName: 'bg-amber-300 ring-amber-100/70',
      };
    case 'pending':
      return {
        label: 'Pending',
        className:
          'bg-sky-400/20 text-sky-100 border border-sky-300/50 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]',
        indicatorClassName: 'bg-sky-300 ring-sky-100/70',
      };
    case 'draft':
      return {
        label: 'Draft',
        className:
          'bg-slate-200/20 text-slate-100 border border-slate-300/40 shadow-[0_0_0_1px_rgba(148,163,184,0.2)]',
        indicatorClassName: 'bg-slate-300 ring-slate-100/60',
      };
    default:
      return null;
  }
}

function withAlpha(color: string | null | undefined, alpha: number): string {
  const fallback = `rgba(99, 102, 241, ${alpha})`;
  if (!color) return fallback;
  const value = color.trim();
  if (!value) return fallback;

  const hex = value.replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const rgbMatch = value.match(
    /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+[\d.]+)?\s*\)$/i
  );
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return fallback;
}

export function BookingBlock({
  block,
  onClick,
  onDoubleClick,
  viewOnly = false,
  stackOffsetPx = 0,
  rowSpanOverride,
}: Props) {
  const accentColor = block.booking.color || 'rgb(99, 102, 241)';
  const rowHeightPx = 50;
  const endAlignmentFudgePx = 1;
  const span = rowSpanOverride ?? block.rowSpan;
  const blockHeightPx = Math.max(
    1,
    span * rowHeightPx + (rowSpanOverride != null ? 0 : endAlignmentFudgePx)
  );
  const changeTag = getPendingChangeTag(block.booking.status);
  const showChangeTag = Boolean(changeTag) && blockHeightPx >= 110;
  const showCompactChangeIndicator = Boolean(changeTag) && blockHeightPx < 110;
  const showCapacity =
    block.booking.capacity !== undefined &&
    block.booking.capacity > 0 &&
    blockHeightPx >= 130;

  return (
    <div
      className={`absolute left-0 right-0 border-l-[5px] border-t border-b border-r rounded-sm transition-all hover:brightness-110 shadow-lg flex flex-col items-center justify-center p-2 z-5 ${viewOnly ? 'cursor-default' : 'cursor-pointer'}`}
      style={{
        top: `${stackOffsetPx + block.startOffsetInSlot * rowHeightPx}px`,
        height: `${blockHeightPx}px`,
        zIndex: 6, // Bookings on top
        left: '4px',
        right: '4px',
        background: `linear-gradient(180deg, ${withAlpha(accentColor, 0.52)} 0%, ${withAlpha(accentColor, 0.36)} 100%)`,
        borderColor: withAlpha(accentColor, 0.96),
        boxShadow: `0 6px 14px rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 0 0 1px ${withAlpha(accentColor, 0.34)}`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!viewOnly && onClick) {
          onClick(block.booking);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (onDoubleClick) {
          onDoubleClick(block.booking);
        }
      }}
    >
      {showChangeTag && (
        <div
          className={`absolute top-1.5 right-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${changeTag!.className}`}
        >
          {changeTag!.label}
        </div>
      )}
      {showCompactChangeIndicator && (
        <div
          className="group/status absolute top-1.5 right-1.5"
          aria-label={`Status: ${changeTag!.label}`}
        >
          <span
            className={`block h-2.5 w-2.5 rounded-full ring-1 ${changeTag!.indicatorClassName}`}
          />
          <span
            className={`pointer-events-none absolute right-0 -top-7 z-[30] whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-0 shadow-xl transition-all duration-100 group-hover/status:-translate-y-0.5 group-hover/status:opacity-100 ${changeTag!.className}`}
          >
            {changeTag!.label}
          </span>
        </div>
      )}
      <div
        className={`w-full flex flex-col items-center ${showChangeTag ? 'pt-3 justify-start' : 'justify-center'}`}
      >
        <div
          className={`${blockHeightPx >= 110 ? 'text-sm' : 'text-[13px]'} font-semibold text-center px-1 break-words`}
          style={{ color: 'rgb(248, 250, 252)' }}
        >
          {block.booking.title}
        </div>
        <div
          className={`${blockHeightPx >= 110 ? 'text-xs mt-1' : 'text-[11px] mt-0.5'} text-center px-1`}
          style={{ color: 'rgb(224, 231, 255)' }}
        >
          {format(new Date(block.booking.start), 'HH:mm')} -{' '}
          {format(new Date(block.booking.end), 'HH:mm')}
        </div>
        {showCapacity && (
          <div
            className="text-[10px] mt-0.5 text-center px-1"
            style={{ color: 'rgb(226, 232, 240)' }}
          >
            {block.booking.capacity} athlete
            {block.booking.capacity !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
