import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { getSideIdByKeyNode, type SideKey } from "../../nodes/data/sidesNodes";
import type { ActiveInstance } from "../../types/snapshot";
import {
  makeBaseLayout,
  makePowerLayout,
  addColumnSpacer,
  addRowSpacer,
  addDoubleColumnSpacers,
} from "../schedule/shared/layouts";
import { getGridConfig } from "../schedule/shared/gridConfig";
import { RackCell } from "../schedule/shared/RackCell";

type Props = {
  /** Which side this floorplan is for */
  sideKey: "Power" | "Base";
  /** Selected rack numbers */
  selectedRacks: number[];
  /** Callback when a rack is clicked */
  onRackClick: (rackNumber: number, replaceSelection?: boolean) => void;
  /** Start time for checking availability (ISO string) */
  startTime: string;
  /** End time for checking availability (ISO string) */
  endTime: string;
  /** Whether to show the "Platforms" title label */
  showTitle?: boolean;
  /** If true, allows clicking on conflicting racks (for editing/selection mode) */
  allowConflictingRacks?: boolean;
};

/**
 * Mini schedule-style floorplan selector for booking creation.
 * Shows a compact grid layout matching the schedule view, with clickable racks,
 * highlighting selected ones and graying out racks that are booked at the requested time.
 */
export function MiniScheduleFloorplan({
  sideKey,
  selectedRacks,
  onRackClick,
  startTime,
  endTime,
  showTitle = true,
  allowConflictingRacks = false,
}: Props) {
  const side = sideKey === "Base" ? "base" : "power";
  const selectedSet = new Set(selectedRacks);

  // Build layout based on side
  const layout = useMemo(() => {
    if (side === "base") {
      const withColSpacer = addColumnSpacer(makeBaseLayout());
      const withRowSpacer = addRowSpacer(withColSpacer, 3);
      return withRowSpacer;
    } else {
      const withCols = addDoubleColumnSpacers(makePowerLayout());
      const withRow = addRowSpacer(withCols, 2);
      return withRow;
    }
  }, [side]);

  // Fetch side ID
  const [sideId, setSideId] = useState<number | null>(null);
  useEffect(() => {
    getSideIdByKeyNode(sideKey as SideKey).then(setSideId).catch(console.error);
  }, [sideKey]);

  // Fetch booking instances that overlap with the requested time
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["booking-instances-for-time", sideId, startTime, endTime],
    queryFn: async () => {
      if (!sideId) return [];

      // Fetch instances that overlap with the requested time range
      const { data, error } = await supabase
        .from("booking_instances")
        .select(
          `
          id,
          booking_id,
          side_id,
          start,
          "end",
          areas,
          racks,
          booking:bookings (
            title,
            color,
            is_locked,
            created_by
          )
        `
        )
        .eq("side_id", sideId)
        .lt("start", endTime) // instance starts before our end time
        .gt("end", startTime) // instance ends after our start time
        .order("start", { ascending: true });

      if (error) {
        console.error("Error fetching instances:", error);
        return [];
      }

      // Normalize the data to match ActiveInstance format
      return (data ?? []).map((row: unknown) => {
        const r = row as {
          id: number;
          booking_id: number;
          start: string;
          end: string;
          racks: number[] | unknown;
          areas: string[] | unknown;
          booking?: {
            title?: string;
            color?: string;
            is_locked?: boolean;
            created_by?: string;
          } | null;
        };
        return {
        instanceId: r.id,
        bookingId: r.booking_id,
        start: r.start,
        end: r.end,
          racks: Array.isArray(r.racks) ? r.racks : [],
          areas: Array.isArray(r.areas) ? r.areas : [],
          title: r.booking?.title ?? "Untitled",
          color: r.booking?.color ?? null,
          isLocked: r.booking?.is_locked ?? false,
          createdBy: r.booking?.created_by ?? null,
        };
      }) as ActiveInstance[];
    },
    enabled: !!sideId && !!startTime && !!endTime,
  });

  // Build a map of which racks are used by other bookings
  const bookedRacks = useMemo(() => {
    const booked = new Set<number>();
    for (const inst of instances) {
      for (const rack of inst.racks) {
        booked.add(rack);
      }
    }
    return booked;
  }, [instances]);

  // Build a set of selected racks that have conflicts (are booked by others)
  const conflictingSelectedRacks = useMemo(() => {
    const conflicting = new Set<number>();
    for (const rack of selectedRacks) {
      if (bookedRacks.has(rack)) {
        conflicting.add(rack);
      }
    }
    return conflicting;
  }, [selectedRacks, bookedRacks]);

  // Build a map of current instance by rack
  const bookingByRack = useMemo(() => {
    const map = new Map<number, ActiveInstance>();
    for (const inst of instances) {
      for (const rack of inst.racks) {
        map.set(rack, inst);
      }
    }
    return map;
  }, [instances]);

  // Grid configuration - compact version (using shared config with custom row heights)
  const baseGridConfig = getGridConfig(side);
  const gridConfig = useMemo(() => {
    if (side === "base") {
      return {
        ...baseGridConfig,
        // Use fixed small row heights instead of 1fr, with walkway spacer (row 4)
        gridTemplateRows: "auto auto auto 0.2fr auto auto auto",
      };
    } else {
      return {
        ...baseGridConfig,
        // Use fixed small row heights instead of 1fr, with walkway spacer (row 3)
        gridTemplateRows: "auto auto 0.2fr auto auto auto",
      };
    }
  }, [side, baseGridConfig]);

  return (
    <div className="w-full">
      {showTitle && <label className="block mb-1 font-medium text-xs">Platforms</label>}
      <div className="border border-slate-700 rounded-md bg-slate-950/60 p-1.5">
        <div className="w-full">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridConfig.gridTemplateColumns,
              gridTemplateRows: gridConfig.gridTemplateRows,
              columnGap: "4px",
              rowGap: "4px",
              padding: "6px",
            }}
          >
            {gridConfig.showBanner && (
              <div
                style={{
                  gridColumn: 3,
                  gridRow: gridConfig.bannerRowSpan,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  writingMode: "vertical-rl",
                  textOrientation: "mixed",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  color: "rgba(148, 163, 184, 0.8)",
                  fontWeight: 600,
                }}
              >
                WHERE HISTORY BEGINS
              </div>
            )}
            {layout.map((row) => {
              const booking = row.rackNumber !== null ? bookingByRack.get(row.rackNumber) ?? null : null;
              const isUsedByOtherBooking = row.rackNumber !== null && bookedRacks.has(row.rackNumber);
              const isSelected = row.rackNumber !== null && selectedSet.has(row.rackNumber);
              // A selected rack has a conflict if it's both selected and booked by another booking
              const hasConflict = row.rackNumber !== null && isSelected && conflictingSelectedRacks.has(row.rackNumber);
              // Conflicting racks are NOT clickable - only available racks can be clicked
              // If there are conflicts in the selection and clicking an available rack, it will clear the week
              const isClickable = row.rackNumber !== null && !row.disabled && (allowConflictingRacks || !isUsedByOtherBooking);

              return (
                <RackCell
                  key={row.id}
                  row={row}
                  booking={booking}
                  isSelected={isSelected}
                  isDisabled={isUsedByOtherBooking}
                  isClickable={isClickable}
                  hasConflict={hasConflict}
                  onClick={() => {
                    if (isClickable && row.rackNumber !== null) {
                      // If there are conflicts in the current week's selection and clicking an available rack,
                      // replace the entire selection with just this rack
                      const weekHasConflicts = conflictingSelectedRacks.size > 0;
                      if (weekHasConflicts) {
                        // When there are conflicts, clicking an available rack should replace the entire selection
                        onRackClick(row.rackNumber, true);
                      } else {
                        // Normal selection behavior when no conflicts
                        onRackClick(row.rackNumber, false);
                      }
                    }
                  }}
                  variant="mini"
                />
              );
            })}
          </div>
        </div>
        {isLoading && (
          <p className="text-xs text-slate-400 mt-1 text-center">Checking availability...</p>
        )}
        {selectedRacks.length > 0 && (
          <p className="text-xs text-slate-300 mt-1 text-center">
            {selectedRacks.length} rack{selectedRacks.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>
    </div>
  );
}

