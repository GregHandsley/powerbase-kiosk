import { useState } from "react";
import { useSideSnapshot } from "../../hooks/useSideSnapshot";
import type { SideKey } from "../../nodes/data/sidesNodes";
import { BaseFloorplan } from "../floorplans/base/BaseFloorplan";
import { PowerbaseFloorSvg } from "../floorplans/power/PowerFloorplan";

export function AdminRackAllocator() {
  const [sideKey, setSideKey] = useState<SideKey>("Power");

  const { snapshot, isLoading, error } = useSideSnapshot(sideKey);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Rack Allocation</h2>
          <p className="text-xs text-slate-300">
            Read-only view of current rack allocations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-300">Side</label>
          <select
            className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
            value={sideKey}
            onChange={(e) => setSideKey(e.target.value as SideKey)}
          >
            <option value="Power">Power</option>
            <option value="Base">Base</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400">Error loading snapshot: {error}</p>
      )}

      <div className="h-64 md:h-72 lg:h-80 border border-slate-700 rounded-lg bg-slate-950/60 overflow-hidden">
        {isLoading && !snapshot ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
            Loading snapshot…
          </div>
        ) : sideKey === "Power" ? (
          <PowerbaseFloorSvg snapshot={snapshot} />
        ) : (
          <BaseFloorplan snapshot={snapshot} />
        )}
      </div>
    </div>
  );
}
