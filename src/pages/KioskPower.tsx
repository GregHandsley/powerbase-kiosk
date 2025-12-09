import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";
import { useSideSnapshot } from "../hooks/useSideSnapshot";
import { POWER_LAYOUT } from "../config/layout";
import { SideFloorplan } from "../components/SideFloorplan";

export function KioskPower() {
  const { snapshot, error, isLoading } = useSideSnapshot("Power");

  return (
    <div className="p-4">
      <AspectRatio ratio={16 / 9}>
        <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-300">
            <span className="font-semibold tracking-wide">Power — Live Kiosk</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400">
                at: {snapshot?.at ?? "loading..."}
              </span>
              <Clock />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 mb-2">
              Error loading snapshot: {error}
            </p>
          )}

          <div className="flex-1 min-h-0">
            {isLoading && !snapshot ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                Loading snapshot...
              </div>
            ) : (
              <SideFloorplan layout={POWER_LAYOUT} snapshot={snapshot} />
            )}
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}
