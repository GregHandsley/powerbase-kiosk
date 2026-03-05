import type { ActiveInstance } from '../../../types/snapshot';
import {
  AREA_FILL,
  AREA_STROKE,
  AREA_STROKE_WIDTH,
  AREA_SELECTED_FILL,
  AREA_SELECTED_STROKE,
  AREA_SELECTED_STROKE_WIDTH,
  AREA_BOOKED_FILL,
  AREA_BOOKED_STROKE,
  AREA_PARTIAL_FILL,
  AREA_PARTIAL_STROKE,
} from './constants';
import { insetRect } from './utils';
import { AreaBookingBadge } from './AreaBookingBadge';

type Props = {
  areaKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string[];
  selected: boolean;
  isFullyBooked: boolean;
  isPartiallyAvailable: boolean;
  areaBookingByKey?: Map<string, ActiveInstance>;
  onClick?: () => void;
  clickable: boolean;
  /** Optional transform for the group (e.g. for machines_2 on Base). */
  transform?: string;
  /** Font size for main label (default 2.1; track uses 2.8). */
  labelFontSize?: number;
};

export function AreaCell({
  areaKey,
  x,
  y,
  w,
  h,
  label,
  selected,
  isFullyBooked,
  isPartiallyAvailable,
  areaBookingByKey,
  onClick,
  clickable,
  transform,
  labelFontSize = 2.1,
}: Props) {
  const r = insetRect(x, y, w, h);
  // const isBooked = isFullyBooked || isPartiallyAvailable;

  return (
    <g
      onClick={clickable ? onClick : undefined}
      style={
        clickable
          ? { cursor: 'pointer' }
          : isFullyBooked
            ? { cursor: 'not-allowed' }
            : undefined
      }
      transform={transform}
    >
      <rect
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        fill={
          isFullyBooked
            ? AREA_BOOKED_FILL
            : isPartiallyAvailable
              ? AREA_PARTIAL_FILL
              : selected
                ? AREA_SELECTED_FILL
                : AREA_FILL
        }
        stroke={
          isFullyBooked
            ? AREA_BOOKED_STROKE
            : isPartiallyAvailable
              ? AREA_PARTIAL_STROKE
              : selected
                ? AREA_SELECTED_STROKE
                : AREA_STROKE
        }
        strokeWidth={
          selected && !isFullyBooked
            ? AREA_SELECTED_STROKE_WIDTH
            : AREA_STROKE_WIDTH
        }
        rx={4}
        ry={4}
      />
      {!isFullyBooked &&
        label.map((line, i) => (
          <text
            key={i}
            x={r.x + r.w / 2}
            y={r.y + r.h / 2 - (label.length > 1 ? 2 : 0) + i * 4}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={
              selected
                ? 'rgba(226, 232, 240, 0.98)'
                : isPartiallyAvailable
                  ? 'rgba(251, 191, 36, 0.95)'
                  : 'rgba(203, 213, 225, 0.9)'
            }
            fontSize={labelFontSize}
            fontWeight={600}
          >
            {line}
          </text>
        ))}
      {isFullyBooked && (
        <>
          <text
            x={r.x + r.w / 2}
            y={r.y + r.h / 2 - 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(148, 163, 184, 0.9)"
            fontSize={labelFontSize}
            fontWeight={600}
          >
            {label[0]}
          </text>
          <text
            x={r.x + r.w / 2}
            y={r.y + r.h / 2 + 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(148, 163, 184, 0.8)"
            fontSize={1.6}
          >
            Booked
          </text>
        </>
      )}
      {isPartiallyAvailable && !selected && (
        <text
          x={r.x + r.w / 2}
          y={r.y + r.h / 2 + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(251, 191, 36, 0.9)"
          fontSize={1.6}
        >
          Partially available
        </text>
      )}
      <AreaBookingBadge
        areaKey={areaKey}
        x={r.x}
        y={r.y}
        w={r.w}
        h={r.h}
        areaBookingByKey={areaBookingByKey}
      />
    </g>
  );
}
