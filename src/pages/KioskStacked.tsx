import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";
import { useSideSnapshot } from "../hooks/useSideSnapshot";
import { POWER_LAYOUT, BASE_LAYOUT } from "../config/layout";
import { SideFloorplan } from "../components/SideFloorplan";

export function KioskStacked() {
  const powerSnapshot = useSideSnapshot("Power");
  const baseSnapshot = useSideSnapshot("Base");

  return (
    <div className="p-4 space-y-4">
      <AspectRatio ratio={16 / 9}>
        <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-300">
            <span className="font-semibold tracking-wide">Power — Stacked View</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400">
                at: {powerSnapshot.snapshot?.at ?? "loading..."}
              </span>
              <Clock />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {powerSnapshot.isLoading && !powerSnapshot.snapshot ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                Loading...
              </div>
            ) : (
              <SideFloorplan
                layout={POWER_LAYOUT}
                snapshot={powerSnapshot.snapshot}
              />
            )}
          </div>
        </div>
      </AspectRatio>

      <AspectRatio ratio={16 / 9}>
        <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-300">
            <span className="font-semibold tracking-wide">Base — Stacked View</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400">
                at: {baseSnapshot.snapshot?.at ?? "loading..."}
              </span>
              <Clock />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {baseSnapshot.isLoading && !baseSnapshot.snapshot ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                Loading...
              </div>
            ) : (
              <SideFloorplan
                layout={BASE_LAYOUT}
                snapshot={baseSnapshot.snapshot}
              />
            )}
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}
