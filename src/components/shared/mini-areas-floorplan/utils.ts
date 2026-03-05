import { GAP } from './constants';

export function insetRect(x: number, y: number, w: number, h: number) {
  const half = GAP / 2;
  return {
    x: x + half,
    y: y + half,
    w: Math.max(0, w - GAP),
    h: Math.max(0, h - GAP),
  };
}

export function truncate(text: string, max: number): string {
  return text.length <= max
    ? text
    : `${text.slice(0, Math.max(0, max - 1))}...`;
}

export function formatTimeRange(startStr: string, endStr: string): string {
  const start = startStr.includes('T') ? startStr.slice(11, 16) : startStr;
  const end = endStr.includes('T') ? endStr.slice(11, 16) : endStr;
  return `${start}-${end}`;
}
