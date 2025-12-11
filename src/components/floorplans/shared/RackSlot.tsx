import type { ActiveInstance, NextUseInfo } from "../../../types/snapshot";
import {
  rackCornerRadius,
  rackFontFamily,
  rackMonoFamily,
  rackPadding,
  rackPalette,
  rackStrokeWidth,
} from "./theme";

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
};

function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRange(startIso: string | null | undefined, endIso: string | null | undefined) {
  const start = formatTime(startIso);
  const end = formatTime(endIso);
  if (!start || !end) return null;
  return `${start}–${end}`;
}

function wrapText(value: string, maxCharsPerLine: number, maxLines: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const isLastLine = lines.length === maxLines - 1;
    const tentative = current.length === 0 ? word : `${current} ${word}`;
    if (tentative.length <= maxCharsPerLine || isLastLine) {
      current = tentative;
    } else {
      if (current.length > 0) {
        lines.push(current);
      }
      current = word;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
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

export function RackSlot({ slot, currentInst, nextUse, snapshotDate }: Props) {
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

  const palette = isOccupied ? rackPalette.occupied : rackPalette.free;

  let statusLine1: string;
  let statusLine2: string | null = null;
  let statusLine3: string | null = null;

  if (!currentInst) {
    statusLine1 = "FREE";
    const nextLabelTime = formatTime(nextUseStartIso);
    statusLine2 =
      nextUseToday && nextLabelTime
        ? nextUseTitle
          ? `Next: ${nextUseTitle} @ ${nextLabelTime}`
          : `Next: ${nextLabelTime}`
        : "Free rest of day";
  } else {
    statusLine1 = currentInst.title;
    statusLine2 = formatRange(currentInst.start, currentInst.end);

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
        nextUseTitle && nextLabelTime ? `Next: ${nextUseTitle} @ ${nextLabelTime}` : `Next: ${nextLabelTime}`;
      statusLine3 = hasFreeWindow ? `Free ${freeWindowStart}–${freeWindowEnd}` : nextLabel;
    } else {
      const endTime = formatTime(currentInst.end);
      statusLine3 = endTime ? `Free after ${endTime} (rest of day)` : "Free later";
    }
  }

  const titleLines = wrapText(statusLine1, 16, 2);
  const status2Lines = statusLine2 ? wrapText(statusLine2, 18, 2) : [];
  const status3Lines = statusLine3 ? wrapText(statusLine3, 18, 3) : [];

  const content: {
    text: string;
    size: number;
    color: string;
    family?: string;
    weight?: string;
    letterSpacing?: number;
    gapAfter: number;
  }[] = [];

  content.push({
    text: `Rack ${slot.number}`,
    size: 1.6,
    color: palette.label,
    weight: "700",
    letterSpacing: 0.2,
    gapAfter: 0.45,
  });

  for (let i = 0; i < titleLines.length; i++) {
    content.push({
      text: titleLines[i],
      size: 1.55,
      color: currentInst ? palette.primary : palette.free,
      weight: "800",
      gapAfter: 0.44,
    });
  }

  for (let i = 0; i < status2Lines.length; i++) {
    content.push({
      text: status2Lines[i],
      size: 1.12,
      color: palette.secondary,
      family: rackMonoFamily,
      weight: "600",
      gapAfter: 0.34,
    });
  }

  for (let i = 0; i < status3Lines.length; i++) {
    content.push({
      text: status3Lines[i],
      size: 1.0,
      color: palette.accent,
      family: rackMonoFamily,
      weight: "600",
      gapAfter: 0.3,
    });
  }

  const totalHeight =
    content.reduce((acc, item) => acc + item.size + item.gapAfter, 0) - (content.at(-1)?.gapAfter ?? 0);
  const available = innerHeight - 1.2;
  const scale = totalHeight > 0 ? Math.min(1, available / totalHeight) : 1;

  const lines: {
    text: string;
    y: number;
    size: number;
    color: string;
    family?: string;
    weight?: string;
    letterSpacing?: number;
  }[] = [];

  let cursorY = innerY + (1.2 / 2);
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

  return (
    <g key={slot.number}>
      <clipPath id={clipId}>
        <rect x={innerX} y={innerY} width={innerWidth} height={innerHeight} />
      </clipPath>

      <rect
        x={slot.x}
        y={slot.y}
        width={slot.width}
        height={slot.height}
        rx={rackCornerRadius}
        ry={rackCornerRadius}
        fill={palette.fill}
        stroke={palette.border}
        strokeWidth={rackStrokeWidth}
      />

      <g clipPath={`url(#${clipId})`}>
        {lines.map((line, idx) => (
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
          >
            {line.text}
          </text>
        ))}
      </g>
    </g>
  );
}