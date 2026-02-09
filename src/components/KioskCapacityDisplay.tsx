import { useKioskCapacity } from '../hooks/useKioskCapacity';
import type { SideKey } from '../nodes/data/sidesNodes';

type Props = {
  sideKey: SideKey;
  currentTime: Date;
};

/**
 * Displays current capacity usage with color coding:
 * - Green: < 80% capacity
 * - Yellow: 80-95% capacity
 * - Red: > 95% capacity or at limit
 */
export function KioskCapacityDisplay({ sideKey, currentTime }: Props) {
  const { used, limit, isLoading, error } = useKioskCapacity(
    sideKey,
    currentTime
  );

  // Only show loading on initial load, not during refetches
  if (isLoading && used === 0 && limit === null) {
    return <div className="text-xs text-slate-400">Loading...</div>;
  }

  if (error) {
    return null; // Silently fail - don't show error on kiosk
  }

  if (limit === null) {
    // No capacity limit set for this time slot
    return (
      <div className="text-xs font-medium text-slate-400">{used} athletes</div>
    );
  }

  // Calculate percentage
  const percentage = (used / limit) * 100;

  // Determine color based on capacity usage
  let colorClass = 'text-slate-300';
  if (percentage >= 95 || used >= limit) {
    colorClass = 'text-rose-300';
  } else if (percentage >= 80) {
    colorClass = 'text-amber-300';
  }

  return (
    <div className={`text-xs font-medium ${colorClass}`}>
      {used} / {limit} athletes
    </div>
  );
}
