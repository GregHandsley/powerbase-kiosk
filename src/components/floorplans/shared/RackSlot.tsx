import type { ActiveInstance, NextUseInfo } from "../../../types/snapshot";

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
  const padding = 0.6; // inset so text never touches the border stroke
  const innerX = slot.x + padding;
  const innerY = slot.y + padding;
  const innerWidth = slot.width - padding * 2;
  const innerHeight = slot.height - padding * 2;

  const rackCenterX = innerX + innerWidth / 2;
  const clipId = `rack-clip-${slot.number}`;

  const nextUseDate = nextUse?.start ? new Date(nextUse.start) : null;
  const nextUseToday = isSameDay(nextUseDate, snapshotDate);
  const nextUseTitle = nextUse?.title ?? null;
  const nextUseStartIso = nextUse?.start ?? null;
  const currentEndDate = currentInst?.end ? new Date(currentInst.end) : null;
  const isOccupied = Boolean(currentInst);

  const palette = isOccupied
    ? {
        fill: "#111b2b",
        border: "#6b7f98",
        label: "#f1f5f9",
        primary: "#f8fafc",
        free: "#c6f6d5",
        secondary: "#dce3ed",
        accent: "#a5f3fc",
      }
    : {
        fill: "#13243a",
        border: "#8ad5ff",
        label: "#f8fafc",
        primary: "#f8fafc",
        free: "#b1f0c5",
        secondary: "#dce3ed",
        accent: "#b5f4ff",
      };

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
      family: '"Inter", "SFMono-Regular", ui-monospace, monospace',
      weight: "600",
      gapAfter: 0.34,
    });
  }

  for (let i = 0; i < status3Lines.length; i++) {
    content.push({
      text: status3Lines[i],
      size: 1.0,
      color: palette.accent,
      family: '"Inter", "SFMono-Regular", ui-monospace, monospace',
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
        rx={2.6}
        ry={2.6}
        fill={palette.fill}
        stroke={palette.border}
        strokeWidth={0.65}
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
            fontFamily={line.family ?? '"SF Pro Display", "Inter", system-ui, sans-serif'}
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

