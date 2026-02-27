import type { PlatformOption } from '../../shared/PlatformSelector';
import type { RackRow } from '../RackListEditorCore';

/** Power open platforms (no rack) - stored as platform numbers in DB like other racks */
export const POWER_OPEN_PLATFORM_1 = 19;
export const POWER_OPEN_PLATFORM_2 = 20;

/**
 * Converts a RackRow layout to PlatformOption array for the PlatformSelector.
 * Filters out non-bookable racks (where rackNumber is null).
 */
export function getAvailablePlatformsFromLayout(
  layout: RackRow[]
): PlatformOption[] {
  return layout
    .filter((row) => row.rackNumber !== null && !row.disabled)
    .map((row) => ({
      number: row.rackNumber!,
      label: row.label,
      disabled: row.disabled,
    }))
    .sort((a, b) => a.number - b.number);
}

/**
 * Gets available platforms for a given side.
 * This is a convenience function that uses the hardcoded layouts.
 */
export function getAvailablePlatformsForSide(
  side: 'power' | 'base'
): PlatformOption[] {
  if (side === 'power') {
    // Power side: racks 1–18 plus open Platform 1 & 2 (19, 20)
    return [
      { number: 1, label: 'Rack 1' },
      { number: 2, label: 'Rack 2' },
      { number: 3, label: 'Rack 3' },
      { number: 4, label: 'Rack 4' },
      { number: 5, label: 'Rack 5' },
      { number: 6, label: 'Rack 6' },
      { number: 7, label: 'Rack 7' },
      { number: 8, label: 'Rack 8' },
      { number: 9, label: 'Rack 9' },
      { number: 10, label: 'Rack 10' },
      { number: 11, label: 'Rack 11' },
      { number: 12, label: 'Rack 12' },
      { number: 13, label: 'Rack 13' },
      { number: 14, label: 'Rack 14' },
      { number: 15, label: 'Rack 15' },
      { number: 16, label: 'Rack 16' },
      { number: 17, label: 'Rack 17' },
      { number: 18, label: 'Rack 18' },
      { number: POWER_OPEN_PLATFORM_1, label: 'Platform 1' },
      { number: POWER_OPEN_PLATFORM_2, label: 'Platform 2' },
    ];
  } else {
    // Base side racks: 1-24
    return Array.from({ length: 24 }, (_, i) => ({
      number: i + 1,
      label: `Rack ${i + 1}`,
    }));
  }
}

/**
 * Display label for a rack/platform number on the schedule or elsewhere.
 * Power: 19 -> "Platform 1", 20 -> "Platform 2"; others -> "Rack N".
 * Base: all "Rack N".
 */
export function getRackOrPlatformLabel(
  side: 'power' | 'base',
  rackNumber: number
): string {
  if (side === 'power' && rackNumber === POWER_OPEN_PLATFORM_1)
    return 'Platform 1';
  if (side === 'power' && rackNumber === POWER_OPEN_PLATFORM_2)
    return 'Platform 2';
  return `Rack ${rackNumber}`;
}

/** True if this rack number is an open platform (Power 19 or 20). */
export function isOpenPlatform(
  side: 'power' | 'base',
  rackNumber: number
): boolean {
  if (side !== 'power') return false;
  return (
    rackNumber === POWER_OPEN_PLATFORM_1 || rackNumber === POWER_OPEN_PLATFORM_2
  );
}

/**
 * Kiosk wayfinding display label: only Power 19/20 show "Platform 1"/"Platform 2";
 * all other platforms show just the number (e.g. "6", "7", "8").
 */
export function getKioskPlatformDisplayLabel(
  side: 'power' | 'base',
  platformNumber: number
): string {
  if (side === 'power' && platformNumber === POWER_OPEN_PLATFORM_1)
    return 'Platform 1';
  if (side === 'power' && platformNumber === POWER_OPEN_PLATFORM_2)
    return 'Platform 2';
  return String(platformNumber);
}
