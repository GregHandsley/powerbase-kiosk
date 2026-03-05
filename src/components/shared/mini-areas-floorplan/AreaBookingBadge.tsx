import type { ActiveInstance } from '../../../types/snapshot';
import { truncate, formatTimeRange } from './utils';

type Props = {
  areaKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  areaBookingByKey?: Map<string, ActiveInstance>;
};

/** Renders "Available" when in Session View with no booking, or the booking badge with title/time. */
export function AreaBookingBadge({
  areaKey,
  x,
  y,
  w,
  h,
  areaBookingByKey,
}: Props) {
  const booking = areaBookingByKey?.get(areaKey);

  if (!booking) {
    if (areaBookingByKey != null) {
      return (
        <g pointerEvents="none">
          <text
            x={x + w / 2}
            y={y + h - 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(148, 163, 184, 0.85)"
            fontSize={1.6}
            fontWeight={500}
          >
            Available
          </text>
        </g>
      );
    }
    return null;
  }

  const insetX = 1.8;
  const insetY = 1.6;
  const badgeWidth = Math.max(0, w - insetX * 2);
  const availableHeight = Math.max(0, h - insetY * 2);
  const showTime = availableHeight >= 8;
  const targetHeight = showTime ? 7.8 : 5.2;
  const badgeHeight = Math.min(targetHeight, availableHeight);
  const badgeY = Math.max(y + insetY, y + h - badgeHeight - insetY);
  const textWidth = Math.max(0, badgeWidth - 1.6);
  const titleMaxChars = Math.max(12, Math.floor((badgeWidth / 2.1) * 1.9));
  const title = truncate(booking.title || 'Untitled', titleMaxChars);
  const slot = booking.area_slots?.find((s) => s.area_key === areaKey);
  const time = showTime
    ? formatTimeRange(slot?.start ?? booking.start, slot?.end ?? booking.end)
    : '';
  let titleY = badgeY + badgeHeight / 2;
  if (showTime) {
    titleY = badgeY + badgeHeight * 0.38;
  }
  const timeY = badgeY + badgeHeight * 0.76;

  return (
    <g pointerEvents="none">
      <rect
        x={x + insetX}
        y={badgeY}
        width={badgeWidth}
        height={badgeHeight}
        rx={1.4}
        ry={1.4}
        fill="rgba(15, 23, 42, 0.82)"
        stroke="rgba(100, 116, 139, 0.7)"
        strokeWidth={0.2}
      />
      <text
        x={x + w / 2}
        y={titleY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(241, 245, 249, 0.98)"
        fontSize={showTime ? 1.78 : 1.95}
        fontWeight={600}
        textLength={textWidth}
        lengthAdjust="spacingAndGlyphs"
      >
        {title}
      </text>
      {showTime && (
        <text
          x={x + w / 2}
          y={timeY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(148, 163, 184, 0.96)"
          fontSize={1.42}
          fontWeight={500}
          textLength={Math.min(textWidth, 11.5)}
          lengthAdjust="spacingAndGlyphs"
        >
          {time}
        </text>
      )}
    </g>
  );
}
