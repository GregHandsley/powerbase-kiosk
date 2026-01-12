import type { BookingInstanceWithBookingRow } from '../../types/db';
import type {
  ActiveInstance,
  NextUseInfo,
  SideSnapshot,
} from '../../types/snapshot';

export function computeSnapshotFromInstances(
  instances: BookingInstanceWithBookingRow[],
  atIso: string
): SideSnapshot {
  const at = new Date(atIso);
  if (Number.isNaN(at.getTime())) {
    throw new Error(
      `Invalid atIso passed to computeSnapshotFromInstances: ${atIso}`
    );
  }

  const currentInstances: ActiveInstance[] = [];
  const nextUseByRack: Record<string, NextUseInfo | null> = {};
  const nextUseByArea: Record<string, NextUseInfo | null> = {};

  for (const inst of instances) {
    const start = new Date(inst.start);
    const end = new Date(inst.end);

    const racks: number[] = Array.isArray(inst.racks) ? inst.racks : [];
    const areas: string[] = Array.isArray(inst.areas) ? inst.areas : [];

    const bookingTitle = inst.booking?.title ?? 'Untitled';
    const bookingColor = inst.booking?.color ?? null;
    const isLocked = inst.booking?.is_locked ?? false;
    const createdBy = inst.booking?.created_by ?? null;
    const status = inst.booking?.status;

    // current: start <= at < end
    if (start <= at && at < end) {
      currentInstances.push({
        instanceId: inst.id,
        bookingId: inst.booking_id,
        start: inst.start,
        end: inst.end,
        racks,
        areas,
        title: bookingTitle,
        color: bookingColor,
        isLocked,
        createdBy,
        status,
      });
    }

    // future: start > at -> contributes to next use
    if (start > at) {
      const startIso = inst.start;
      const nextInfo: NextUseInfo = { start: startIso, title: bookingTitle };

      for (const r of racks) {
        const key = String(r);
        const existing = nextUseByRack[key];
        if (!existing || new Date(startIso) < new Date(existing.start)) {
          nextUseByRack[key] = nextInfo;
        }
      }

      for (const areaKey of areas) {
        const key = String(areaKey);
        const existing = nextUseByArea[key];
        if (!existing || new Date(startIso) < new Date(existing.start)) {
          nextUseByArea[key] = nextInfo;
        }
      }
    }
  }

  const sideId = instances.length > 0 ? instances[0].side_id : null;

  return {
    at: atIso,
    sideId,
    currentInstances,
    nextUseByRack,
    nextUseByArea,
  };
}
