import { memo } from 'react';
import type { ActiveInstance, NextUseInfo } from '../../../types/snapshot';
import {
  rackCornerRadiusByAppearance,
  rackFontFamilyByAppearance,
  rackMonoFamilyByAppearance,
  rackPaddingByAppearance,
  rackPaletteByAppearance,
  rackStrokeWidthByAppearance,
  type RackAppearance,
} from './theme';

export type RackLayoutSlot = {
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  slot: RackLayoutSlot;
  currentInst: ActiveInstance | null;
  nextUse: NextUseInfo | null;
  snapshotDate: Date;
  appearance?: RackAppearance;
  isHighlighted?: boolean;
  isDimmed?: boolean;
};

function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined
) {
  const start = formatTime(startIso);
  const end = formatTime(endIso);
  if (!start || !end) return null;
  return `${start}–${end}`;
}

function wrapText(value: string, maxCharsPerLine: number, maxLines: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  let truncated = false;

  for (const word of words) {
    const isLastLine = lines.length === maxLines - 1;
    const tentative = current.length === 0 ? word : `${current} ${word}`;
    if (tentative.length <= maxCharsPerLine) {
      current = tentative;
      continue;
    }

    if (isLastLine) {
      truncated = true;
      break;
    }

    if (current.length > 0) {
      lines.push(current);
    }
    current = word;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (truncated) {
    const lastIndex = Math.min(lines.length, maxLines) - 1;
    if (lastIndex >= 0) {
      const maxLen = Math.max(1, maxCharsPerLine - 3);
      const base = lines[lastIndex].slice(0, maxLen).trimEnd();
      lines[lastIndex] = `${base}...`;
    }
  }

  return lines.slice(0, maxLines);
}

function isSameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function RackSlotComponent({
  slot,
  currentInst,
  nextUse,
  snapshotDate,
  appearance = 'default',
  isHighlighted = false,
  isDimmed = false,
}: Props) {
  const resolvedAppearance = appearance ?? 'default';
  const rackPadding = rackPaddingByAppearance[resolvedAppearance];
  const rackCornerRadius = rackCornerRadiusByAppearance[resolvedAppearance];
  const rackStrokeWidth = rackStrokeWidthByAppearance[resolvedAppearance];
  const rackFontFamily = rackFontFamilyByAppearance[resolvedAppearance];
  const rackMonoFamily = rackMonoFamilyByAppearance[resolvedAppearance];
  const isKiosk = resolvedAppearance === 'kiosk';
  const isStatusBoard = resolvedAppearance === 'status-board';

  const innerX = slot.x + rackPadding;
  const innerY = slot.y + rackPadding;
  const innerWidth = slot.width - rackPadding * 2;
  const innerHeight = slot.height - rackPadding * 2;

  const rackCenterX = innerX + innerWidth / 2;
  const clipId = `rack-clip-${slot.number}`;

  const nextUseDate = nextUse?.start ? new Date(nextUse.start) : null;
  const nextUseToday = isSameDay(nextUseDate, snapshotDate);
  const nextUseTitle = nextUse?.title ?? null;
  const nextUseStartIso = nextUse?.start ?? null;
  const currentEndDate = currentInst?.end ? new Date(currentInst.end) : null;
  const isOccupied = Boolean(currentInst);

  const palette = isOccupied
    ? rackPaletteByAppearance[resolvedAppearance].occupied
    : rackPaletteByAppearance[resolvedAppearance].free;

  let statusLine1: string;
  let statusLine2: string | null = null;
  let statusLine3: string | null = null;

  if (isStatusBoard) {
    if (!currentInst) {
      statusLine1 = 'Available';
      const availableUntil = nextUseToday ? formatTime(nextUseStartIso) : null;
      statusLine2 = availableUntil ? `until ${availableUntil}` : 'until close';
    } else {
      statusLine1 = currentInst.title;
      const endTime = formatTime(currentInst.end);
      statusLine2 = endTime ? `until ${endTime}` : null;
    }
  } else if (!currentInst) {
    statusLine1 = 'Available';
    const nextLabelTime = formatTime(nextUseStartIso);
    statusLine2 =
      nextUseToday && nextLabelTime
        ? nextUseTitle
          ? `Next: ${nextUseTitle} @ ${nextLabelTime}`
          : `Next: ${nextLabelTime}`
        : 'Free until close';
  } else {
    statusLine1 = currentInst.title;
    const range = formatRange(currentInst.start, currentInst.end);
    statusLine2 = range ? range : null;

    if (nextUseStartIso && nextUseToday) {
      const freeWindowStart = formatTime(currentInst.end);
      const freeWindowEnd = formatTime(nextUseStartIso);
      const hasFreeWindow =
        freeWindowStart &&
        freeWindowEnd &&
        currentEndDate &&
        nextUseDate &&
        nextUseDate.getTime() > currentEndDate.getTime();
      const nextLabelTime = formatTime(nextUseStartIso);
      const nextLabel =
        nextUseTitle && nextLabelTime
          ? `Next: ${nextUseTitle} @ ${nextLabelTime}`
          : `Next: ${nextLabelTime}`;
      statusLine3 = hasFreeWindow
        ? `Free ${freeWindowStart}–${freeWindowEnd}`
        : nextLabel;
    } else {
      const endTime = formatTime(currentInst.end);
      statusLine3 = endTime ? `Free after ${endTime}` : 'Free later';
    }
  }

  const titleLines = wrapText(
    statusLine1,
    isStatusBoard ? 14 : 16,
    isStatusBoard ? 3 : 2
  );
  const status2Lines = statusLine2
    ? wrapText(statusLine2, isStatusBoard ? 16 : 18, isStatusBoard ? 1 : 2)
    : [];
  const status3Lines =
    !isStatusBoard && statusLine3 ? wrapText(statusLine3, 18, 3) : [];

  // Build content with strict hierarchy
  const content: {
    text: string;
    size: number;
    color: string;
    family?: string;
    weight?: string;
    letterSpacing?: number;
    gapAfter: number;
  }[] = [];

  const typography = isStatusBoard
    ? {
        // Platform number - large, minimal, no badge needed
        labelSize: 2.6,
        labelWeight: '700',
        labelLetterSpacing: -0.05,
        labelGap: 0.4,
        // Status/Title - prominent but not overwhelming
        titleSize: 1.5,
        titleWeight: '600',
        titleWeightAvailable: '600',
        titleGap: 0.35,
        // Meta info - subtle but readable
        metaSize: 1.0,
        metaWeight: '400',
        metaGap: 0.3,
        metaAccentSize: 0.9,
        metaAccentWeight: '400',
        metaAccentGap: 0.25,
      }
    : isKiosk
      ? {
          labelSize: 1.1,
          labelWeight: '500',
          labelLetterSpacing: 0.18,
          labelGap: 0.6,
          titleSize: 1.9,
          titleWeight: '600',
          titleWeightAvailable: '500',
          titleGap: 0.7,
          metaSize: 1.0,
          metaWeight: '500',
          metaGap: 0.5,
          metaAccentSize: 0.95,
          metaAccentWeight: '500',
          metaAccentGap: 0.45,
        }
      : {
          labelSize: 1.25,
          labelWeight: '700',
          labelLetterSpacing: 0.25,
          labelGap: 0.5,
          titleSize: 2.1,
          titleWeight: '800',
          titleWeightAvailable: '900',
          titleGap: 0.55,
          metaSize: 1.15,
          metaWeight: '600',
          metaGap: 0.36,
          metaAccentSize: 1.05,
          metaAccentWeight: '600',
          metaAccentGap: 0.32,
        };

  // Top: Platform number - large, minimal, no badge
  const labelText = isStatusBoard ? String(slot.number) : `Rack ${slot.number}`;
  // Platform number - Apple-like clarity and contrast
  const labelColor = isStatusBoard
    ? isOccupied
      ? 'rgba(255, 255, 255, 0.98)' // Booked: Bright white for maximum contrast
      : 'rgba(226, 232, 240, 0.85)' // Available: Light gray - much more visible
    : isOccupied
      ? isHighlighted
        ? '#ffffff'
        : '#f1f5f9'
      : isHighlighted
        ? '#60a5fa'
        : '#94a3b8';

  content.push({
    text: labelText,
    size: typography.labelSize,
    color: labelColor,
    weight: typography.labelWeight,
    letterSpacing: typography.labelLetterSpacing,
    gapAfter: typography.labelGap,
  });

  // Middle: dominant line (squad or Available) - Apple-like clarity
  for (let i = 0; i < titleLines.length; i++) {
    // For status-board, clear and purposeful colors
    const statusColor =
      isStatusBoard && !currentInst
        ? 'rgba(96, 165, 250, 0.95)' // Available: Vibrant blue - clear and visible
        : isStatusBoard && currentInst
          ? 'rgba(255, 255, 255, 0.98)' // Booked: Bright white for maximum contrast
          : !currentInst
            ? (palette.primaryStrong ?? palette.primary)
            : palette.primary;
    content.push({
      text: titleLines[i],
      size: typography.titleSize,
      color: statusColor,
      weight: !currentInst
        ? typography.titleWeightAvailable
        : typography.titleWeight,
      gapAfter: typography.titleGap,
    });
  }

  // Bottom: functional mono (time / next)
  for (let i = 0; i < status2Lines.length; i++) {
    content.push({
      text: status2Lines[i],
      size: typography.metaSize,
      color: palette.secondary,
      family: rackMonoFamily,
      weight: typography.metaWeight,
      gapAfter: typography.metaGap,
    });
  }

  for (let i = 0; i < status3Lines.length; i++) {
    content.push({
      text: status3Lines[i],
      size: typography.metaAccentSize,
      color: palette.accent,
      family: rackMonoFamily,
      weight: typography.metaAccentWeight,
      gapAfter: typography.metaAccentGap,
    });
  }

  const totalHeight =
    content.reduce((acc, item) => acc + item.size + item.gapAfter, 0) -
    (content.at(-1)?.gapAfter ?? 0);
  // Better spacing for status-board - not cramped
  const available = isStatusBoard ? innerHeight - 1.0 : innerHeight - 1.2;
  const scale = totalHeight > 0 ? Math.min(1, available / totalHeight) : 1;

  // Liquid glass layout - comfortable spacing
  const contentStartY = isStatusBoard ? innerY + 0.7 : innerY + 1.2 / 2;

  const lines: {
    text: string;
    y: number;
    size: number;
    color: string;
    family?: string;
    weight?: string;
    letterSpacing?: number;
  }[] = [];

  // Adjust starting position for status-board with badge
  let cursorY = isStatusBoard ? contentStartY : innerY + 1.2 / 2;
  for (const item of content) {
    const size = item.size * scale;
    lines.push({
      text: item.text,
      y: cursorY + size,
      size,
      color: item.color,
      family: item.family,
      weight: item.weight,
      letterSpacing: item.letterSpacing,
    });
    cursorY += size + item.gapAfter * scale;
  }

  const gradientId = `rack-grad-${slot.number}-${isOccupied ? 'occ' : 'free'}`;
  const shadeId = `rack-shade-${slot.number}`;
  const shadowId = `rack-shadow-${slot.number}`;
  const borderGradientId = `rack-border-${slot.number}`;
  const showKioskShadow = isKiosk && isOccupied;
  const showDefaultGradient = resolvedAppearance === 'default';
  const showStatusBoardPremium = isStatusBoard;

  // Make non-highlighted platforms more visible but still subtle
  const fillOpacity = isDimmed ? 0.75 : 1;
  const textOpacity = isDimmed ? 0.8 : 1;
  const showHighlight = isHighlighted && !isDimmed;
  const highlightOpacity = showHighlight ? 1 : 0;
  const highlightStroke = palette.accent;
  const highlightStrokeWidth = isStatusBoard ? 0.5 : 1;
  const highlightCornerRadius = Math.max(1, rackCornerRadius);
  const highlightHaloId = `rack-halo-${slot.number}`;
  const baseStyle =
    isHighlighted || isDimmed
      ? { transition: 'opacity 300ms ease' }
      : undefined;
  const highlightStyle = {
    opacity: highlightOpacity,
    transition: 'opacity 300ms ease',
  };

  return (
    <g key={slot.number}>
      <defs>
        {showDefaultGradient && (
          <>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={palette.fillTop} />
              <stop offset="100%" stopColor={palette.fillBottom} />
            </linearGradient>
            <linearGradient id={shadeId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="70%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
            </linearGradient>
          </>
        )}
        {showKioskShadow && (
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow
              dx="0"
              dy="1.2"
              stdDeviation="1.2"
              floodColor="rgba(2, 6, 23, 0.45)"
            />
          </filter>
        )}
        {showStatusBoardPremium && (
          <>
            {/* Apple-like background gradient - clear distinction between booked and available */}
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor={
                  isOccupied
                    ? isDimmed
                      ? 'rgba(37, 99, 235, 0.55)' // Booked: More vibrant blue when dimmed
                      : 'rgba(37, 99, 235, 0.48)' // Booked: Vibrant blue for clear visibility
                    : isDimmed
                      ? 'rgba(30, 41, 59, 0.65)' // Available: More visible dark slate when dimmed
                      : 'rgba(30, 41, 59, 0.58)' // Available: Visible dark slate - much better contrast
                }
              />
              <stop
                offset="50%"
                stopColor={
                  isOccupied
                    ? isDimmed
                      ? 'rgba(29, 78, 216, 0.48)'
                      : 'rgba(29, 78, 216, 0.42)' // Booked: Rich blue gradient
                    : isDimmed
                      ? 'rgba(15, 23, 42, 0.55)'
                      : 'rgba(15, 23, 42, 0.50)' // Available: Better visibility
                }
              />
              <stop
                offset="100%"
                stopColor={
                  isOccupied
                    ? isDimmed
                      ? 'rgba(30, 64, 175, 0.42)'
                      : 'rgba(30, 64, 175, 0.36)' // Booked: Deep blue bottom
                    : isDimmed
                      ? 'rgba(2, 6, 23, 0.48)'
                      : 'rgba(2, 6, 23, 0.42)' // Available: Darker bottom for depth
                }
              />
            </linearGradient>
            {/* Apple-like border - clear and purposeful */}
            <linearGradient id={borderGradientId} x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor={
                  isOccupied
                    ? 'rgba(96, 165, 250, 0.25)' // Booked: Visible blue border
                    : 'rgba(148, 163, 184, 0.20)' // Available: Visible gray border
                }
              />
              <stop
                offset="100%"
                stopColor={
                  isOccupied
                    ? 'rgba(59, 130, 246, 0.18)'
                    : 'rgba(100, 116, 139, 0.15)' // Available: Subtle but visible
                }
              />
            </linearGradient>
            {/* Inner highlight gradient for glass effect */}
            <linearGradient id="glassHighlight" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.15)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            </linearGradient>
            {/* Removed shadow for clean appearance */}
            <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="0"
                floodColor="transparent"
                floodOpacity="0"
              />
            </filter>
          </>
        )}
        <radialGradient id={highlightHaloId} cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor={highlightStroke} stopOpacity="0.35" />
          <stop offset="60%" stopColor={highlightStroke} stopOpacity="0.12" />
          <stop offset="100%" stopColor={highlightStroke} stopOpacity="0" />
        </radialGradient>
      </defs>

      <clipPath id={clipId}>
        <rect x={innerX} y={innerY} width={innerWidth} height={innerHeight} />
      </clipPath>

      {/* Liquid glass background - layered for depth */}
      {showStatusBoardPremium && (
        <>
          {/* Base layer to prevent white flash */}
          <rect
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            rx={rackCornerRadius}
            ry={rackCornerRadius}
            fill={
              isOccupied ? 'rgba(37, 99, 235, 0.35)' : 'rgba(15, 23, 42, 0.35)'
            }
            opacity={fillOpacity}
          />
          {/* Main glass background */}
          <rect
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            rx={rackCornerRadius}
            ry={rackCornerRadius}
            fill={
              showDefaultGradient
                ? `url(#${gradientId})`
                : `url(#${gradientId})`
            }
            stroke="none"
            strokeWidth="0"
            opacity={fillOpacity}
            style={baseStyle}
          />
          {/* Apple-like inner highlight for depth */}
          <rect
            x={slot.x + 0.15}
            y={slot.y + 0.15}
            width={slot.width - 0.3}
            height={slot.height * 0.45}
            rx={rackCornerRadius * 0.8}
            ry={rackCornerRadius * 0.8}
            fill="url(#glassHighlight)"
            opacity={
              isOccupied
                ? fillOpacity * 0.12 // Booked: More visible highlight
                : fillOpacity * 0.1 // Available: Subtle but visible
            }
            style={baseStyle}
          />
          {/* Border stroke for clear definition */}
          <rect
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            rx={rackCornerRadius}
            ry={rackCornerRadius}
            fill="none"
            stroke={`url(#${borderGradientId})`}
            strokeWidth="0.5"
            opacity={fillOpacity}
            style={baseStyle}
          />
        </>
      )}
      {!showStatusBoardPremium && (
        <>
          {/* Base layer to prevent white flash */}
          <rect
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            rx={rackCornerRadius}
            ry={rackCornerRadius}
            fill={isOccupied ? '#1e3a8a' : '#1e293b'}
            opacity={0.3}
          />
          {/* Main content layer */}
          <rect
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            rx={rackCornerRadius}
            ry={rackCornerRadius}
            fill={showDefaultGradient ? `url(#${gradientId})` : palette.fill}
            stroke={showDefaultGradient ? palette.stroke : 'none'}
            strokeWidth={showDefaultGradient ? rackStrokeWidth : 0}
            filter={showKioskShadow ? `url(#${shadowId})` : undefined}
            opacity={fillOpacity}
            style={baseStyle}
          />
        </>
      )}
      <rect
        x={slot.x + 0.2}
        y={slot.y + 0.2}
        width={slot.width - 0.4}
        height={slot.height - 0.4}
        rx={highlightCornerRadius}
        ry={highlightCornerRadius}
        fill="none"
        stroke={highlightStroke}
        strokeWidth={highlightStrokeWidth}
        strokeLinejoin="round"
        pointerEvents="none"
        style={highlightStyle}
      />
      {showDefaultGradient && (
        <rect
          x={slot.x}
          y={slot.y}
          width={slot.width}
          height={slot.height}
          rx={rackCornerRadius}
          ry={rackCornerRadius}
          fill={`url(#${shadeId})`}
          stroke="none"
          pointerEvents="none"
        />
      )}

      <g clipPath={`url(#${clipId})`}>
        {lines.map((line, idx) => {
          return (
            <text
              key={idx}
              x={rackCenterX}
              y={line.y}
              textAnchor="middle"
              fontSize={line.size}
              fill={line.color}
              fontFamily={line.family ?? rackFontFamily}
              fontWeight={line.weight}
              letterSpacing={line.letterSpacing}
              opacity={textOpacity}
            >
              {line.text}
            </text>
          );
        })}
      </g>
    </g>
  );
}

function instKey(inst: ActiveInstance | null) {
  if (!inst) return '';
  return [
    (inst as { id?: string }).id ?? '',
    (inst as { title?: string }).title ?? '',
    (inst as { start?: string }).start ?? '',
    (inst as { end?: string }).end ?? '',
  ].join('|');
}

function nextUseKey(nextUse: NextUseInfo | null) {
  if (!nextUse) return '';
  return [
    (nextUse as { title?: string }).title ?? '',
    (nextUse as { start?: string }).start ?? '',
    (nextUse as { end?: string }).end ?? '',
  ].join('|');
}

function areRackSlotPropsEqual(prev: Props, next: Props) {
  if (prev.appearance !== next.appearance) return false;
  if (prev.isHighlighted !== next.isHighlighted) return false;
  if (prev.isDimmed !== next.isDimmed) return false;
  if (prev.snapshotDate.getTime() !== next.snapshotDate.getTime()) return false;
  if (instKey(prev.currentInst) !== instKey(next.currentInst)) return false;
  if (nextUseKey(prev.nextUse) !== nextUseKey(next.nextUse)) return false;
  return (
    prev.slot.number === next.slot.number &&
    prev.slot.x === next.slot.x &&
    prev.slot.y === next.slot.y &&
    prev.slot.width === next.slot.width &&
    prev.slot.height === next.slot.height
  );
}

export const RackSlot = memo(RackSlotComponent, areRackSlotPropsEqual);
