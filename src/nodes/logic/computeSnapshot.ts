import type { BookingInstanceWithBookingRow } from "../../types/db";
import type { ActiveInstance, SideSnapshot } from "../../types/snapshot";

export function computeSnapshotFromInstances(
  instances: BookingInstanceWithBookingRow[],
  atIso: string
): SideSnapshot {
  const at = new Date(atIso);
  if (Number.isNaN(at.getTime())) {
    throw new Error(`Invalid atIso passed to computeSnapshotFromInstances: ${atIso}`);
  }

  const currentInstances: ActiveInstance[] = [];
  const nextUseByRack: Record<string, string | null> = {};
  const nextUseByArea: Record<string, string | null> = {};

  for (const inst of instances) {
    const start = new Date(inst.start);
    const end = new Date(inst.end);

    const racks: number[] = Array.isArray(inst.racks) ? inst.racks : [];
    const areas: string[] = Array.isArray(inst.areas) ? inst.areas : [];

    const bookingTitle = inst.booking?.title ?? "Untitled";
    const bookingColor = inst.booking?.color ?? null;

    // current: start <= at < end
    if (start <= at && at < end) {
      currentInstances.push({
        id: inst.id,
        start: inst.start,
        end: inst.end,
        racks,
        areas,
        title: bookingTitle,
        color: bookingColor,
      });
    }

    // future: start > at -> contributes to next use
    if (start > at) {
      const startIso = inst.start;

      for (const r of racks) {
        const key = String(r);
        const existing = nextUseByRack[key];
        if (!existing || new Date(startIso) < new Date(existing)) {
          nextUseByRack[key] = startIso;
        }
      }

      for (const areaKey of areas) {
        const key = String(areaKey);
        const existing = nextUseByArea[key];
        if (!existing || new Date(startIso) < new Date(existing)) {
          nextUseByArea[key] = startIso;
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
