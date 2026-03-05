/**
 * Canonical state and signature for processed bookings.
 * Used to "tag" the state when a booking is processed so we never show
 * the same changes again (no repeat, and no missing logic).
 */

import type { ProcessedSnapshot } from '../hooks/useBookingsTeam';

/** Instance shape used for canonical comparison (from snapshot or current instances). */
type CanonicalInstance = {
  start: string;
  end: string;
  racks: number[];
  areas: string[];
  capacity: number;
};

/** Build a canonical instance for hashing (sorted arrays, stable keys). */
function toCanonicalInstance(inst: {
  start: string;
  end: string;
  racks?: number[];
  areas?: string[];
  capacity?: number;
}): CanonicalInstance {
  const racks = [...(inst.racks ?? [])].sort((a, b) => a - b);
  const areas = [...(inst.areas ?? [])].sort();
  return {
    start: inst.start,
    end: inst.end,
    racks,
    areas,
    capacity: inst.capacity ?? 1,
  };
}

/**
 * Build canonical state from current booking instances (same shape as from snapshot).
 * Used to compare current state to processed_snapshot_signature so we don't show
 * changes that have already been processed.
 */
export function buildCanonicalStateFromInstances(
  instances: Array<{
    start: string;
    end: string;
    racks?: number[];
    areas?: string[];
    capacity?: number;
  }>
): string {
  const canonical = instances
    .map(toCanonicalInstance)
    .sort((a, b) => a.start.localeCompare(b.start));
  return JSON.stringify(canonical);
}

/**
 * Build canonical state from a ProcessedSnapshot so we can store a signature
 * when processing. Must match the shape produced from instances for comparison.
 */
export function buildCanonicalStateFromSnapshot(
  snapshot: ProcessedSnapshot
): string {
  const startsSet = new Set<string>();
  if (snapshot.allInstanceStarts?.length) {
    snapshot.allInstanceStarts.forEach((s) => startsSet.add(s));
  }
  snapshot.allInstanceRacks?.forEach((r) => startsSet.add(r.start));
  snapshot.allInstanceTimes?.forEach((t) => startsSet.add(t.start));
  snapshot.allInstanceCapacities?.forEach((c) => startsSet.add(c.start));
  snapshot.allInstanceAreas?.forEach((a) => startsSet.add(a.start));
  if (startsSet.size === 0 && snapshot.firstInstanceStart) {
    startsSet.add(snapshot.firstInstanceStart);
  }

  const byStart = new Map<string, CanonicalInstance>();
  const formatDate = (iso: string) => iso.slice(0, 10);

  for (const start of startsSet) {
    const racks =
      snapshot.allInstanceRacks?.find(
        (r) => r.start === start || formatDate(r.start) === formatDate(start)
      )?.racks ??
      snapshot.firstInstanceRacks ??
      [];
    const areas =
      snapshot.allInstanceAreas?.find(
        (a) => a.start === start || formatDate(a.start) === formatDate(start)
      )?.areas ??
      snapshot.firstInstanceAreas ??
      [];
    const capacity =
      snapshot.allInstanceCapacities?.find(
        (c) => c.start === start || formatDate(c.start) === formatDate(start)
      )?.capacity ??
      snapshot.firstInstanceCapacity ??
      1;
    const end =
      snapshot.allInstanceTimes?.find(
        (t) => t.start === start || formatDate(t.start) === formatDate(start)
      )?.end ??
      snapshot.firstInstanceEnd ??
      '';

    byStart.set(
      start,
      toCanonicalInstance({ start, end, racks, areas, capacity })
    );
  }

  const canonical = Array.from(byStart.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, inst]) => inst);
  return JSON.stringify(canonical);
}

/** Simple non-crypto hash for tagging (deterministic, short string). */
export function hashCanonicalState(canonical: string): string {
  let h = 5381;
  for (let i = 0; i < canonical.length; i++) {
    h = (h * 33) ^ canonical.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function getProcessedSnapshotSignature(
  snapshot: ProcessedSnapshot
): string {
  return hashCanonicalState(buildCanonicalStateFromSnapshot(snapshot));
}

export function getCurrentStateSignature(
  instances: Array<{
    start: string;
    end: string;
    racks?: number[];
    areas?: string[];
    capacity?: number;
  }>
): string {
  return hashCanonicalState(buildCanonicalStateFromInstances(instances));
}
