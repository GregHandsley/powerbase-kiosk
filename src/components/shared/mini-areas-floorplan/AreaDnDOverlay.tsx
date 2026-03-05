import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ActiveInstance } from '../../../types/snapshot';
import { getAreaDefs } from './areaDefs';
import { VIEWBOX_WIDTH, VIEWBOX_HEIGHT } from './constants';
import { insetRect } from './utils';
import type { AreaDef } from './types';

type AreaDnDOverlayProps = {
  sideKey: 'Power' | 'Base';
  areaBookingByKey: Map<string, ActiveInstance>;
  areaKeysFilter?: string[];
  renderBox: { x: number; y: number; width: number; height: number };
  onEditBooking?: (booking: ActiveInstance) => void;
};

export function AreaDnDOverlay({
  sideKey,
  areaBookingByKey,
  areaKeysFilter,
  renderBox,
  onEditBooking,
}: AreaDnDOverlayProps) {
  const isVisible = (key: string) =>
    !areaKeysFilter?.length || areaKeysFilter.includes(key);

  const areaDefs = getAreaDefs(sideKey).filter((a) => isVisible(a.key));

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: renderBox.x,
        top: renderBox.y,
        width: renderBox.width,
        height: renderBox.height,
      }}
    >
      {areaDefs.map((area) => (
        <AreaDropZone
          key={area.key}
          area={area}
          booking={areaBookingByKey.get(area.key)}
          onEditBooking={onEditBooking}
        />
      ))}
    </div>
  );
}

function AreaDropZone({
  area,
  booking,
  onEditBooking,
}: {
  area: AreaDef;
  booking?: ActiveInstance;
  onEditBooking?: (booking: ActiveInstance) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `area-drop-${area.key}`,
    data: { areaKey: area.key },
  });

  const { x, y, w, h } = insetRect(area.x, area.y, area.w, area.h);

  return (
    <div
      ref={setNodeRef}
      className="pointer-events-auto absolute"
      style={{
        left: `${(x / VIEWBOX_WIDTH) * 100}%`,
        top: `${(y / VIEWBOX_HEIGHT) * 100}%`,
        width: `${(w / VIEWBOX_WIDTH) * 100}%`,
        height: `${(h / VIEWBOX_HEIGHT) * 100}%`,
      }}
    >
      {isOver && (
        <div className="pointer-events-none absolute inset-[2px] rounded-[6px] border border-indigo-400/75 bg-indigo-500/5" />
      )}
      {booking ? (
        <AreaBookingDraggableCard
          booking={booking}
          areaKey={area.key}
          compact={h < 24 || w < 28}
          onEditBooking={onEditBooking}
        />
      ) : (
        <div className="absolute inset-0 flex items-end justify-center pb-0.5 pointer-events-none">
          <span className="text-[9px] font-medium text-slate-400">
            Available
          </span>
        </div>
      )}
    </div>
  );
}

function AreaBookingDraggableCard({
  booking,
  areaKey,
  compact = false,
  onEditBooking,
}: {
  booking: ActiveInstance;
  areaKey: string;
  compact?: boolean;
  onEditBooking?: (booking: ActiveInstance) => void;
}) {
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    x: number;
    y: number;
  } | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const slot = booking.area_slots?.find((s) => s.area_key === areaKey);
  const displayStart = slot?.start ?? booking.start;
  const displayEnd = slot?.end ?? booking.end;
  const timeLabel = (s: string) => (s.includes('T') ? s.slice(11, 16) : s);
  const timeStr = `${timeLabel(displayStart)}-${timeLabel(displayEnd)}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `area-booking-${booking.instanceId}-${areaKey}`,
      data: {
        booking,
        fromAreaKey: areaKey,
      },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  };

  const shouldShowExpandedTooltip = () => {
    if (compact) return true;
    const node = titleRef.current;
    if (!node) return false;
    return node.scrollWidth > node.clientWidth;
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (onEditBooking) {
          onEditBooking(booking);
        }
      }}
      className="absolute left-[8%] right-[8%] bottom-[10%] max-h-[42%] overflow-hidden rounded-md border border-slate-500/90 bg-slate-900/88 px-1 py-0.5 cursor-grab active:cursor-grabbing select-none shadow-sm"
      onMouseEnter={(e) => {
        if (!shouldShowExpandedTooltip()) return;
        setTooltip({ show: true, x: e.clientX, y: e.clientY });
      }}
      onMouseMove={(e) => {
        if (!shouldShowExpandedTooltip()) return;
        setTooltip((prev) =>
          prev ? { ...prev, x: e.clientX, y: e.clientY } : prev
        );
      }}
      onMouseLeave={() => setTooltip(null)}
      onMouseUp={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        ref={titleRef}
        className="text-[9px] leading-tight font-semibold text-slate-100 truncate text-center"
      >
        {booking.title}
      </div>
      {!compact && (
        <div className="text-[8px] leading-tight text-slate-300 text-center mt-0.5">
          {timeStr}
        </div>
      )}
      {tooltip?.show &&
        !isDragging &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[220] min-w-[180px] max-w-[260px] rounded-md border border-indigo-300/70 bg-slate-950 px-2.5 py-1.5 text-[10px] text-slate-100 shadow-[0_10px_24px_rgba(2,6,23,0.85)] ring-1 ring-indigo-400/30"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 12,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="font-semibold break-words">{booking.title}</div>
            <div className="mt-0.5 text-slate-300">{timeStr}</div>
          </div>,
          document.body
        )}
    </div>
  );
}
