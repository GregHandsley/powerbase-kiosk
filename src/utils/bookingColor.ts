const BOOKING_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#22c55e', // green
  '#84cc16', // lime
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // purple
  '#6366f1', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDeterministicBookingColor(
  organizationId: number,
  bookingType: 'catalogue' | 'one_off',
  squadId: number | null,
  displayName: string
): string {
  const key =
    bookingType === 'catalogue' && squadId
      ? `org:${organizationId}|squad:${squadId}`
      : `org:${organizationId}|oneoff:${displayName.trim().toLowerCase()}`;
  const idx = hashString(key) % BOOKING_COLOR_PALETTE.length;
  return BOOKING_COLOR_PALETTE[idx];
}
