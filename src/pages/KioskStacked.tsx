import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";

export function KioskStacked() {
  return (
    <div className="p-4 space-y-4">
      <AspectRatio ratio={16 / 9}>
        <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4 text-xs text-slate-300">
            <span className="font-semibold tracking-wide">Power — Stacked View</span>
            <Clock />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-slate-400 text-sm">
              Top: Power floorplan (coming in later sprint).
            </span>
          </div>
        </div>
      </AspectRatio>

      <AspectRatio ratio={16 / 9}>
        <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4 text-xs text-slate-300">
            <span className="font-semibold tracking-wide">Base — Stacked View</span>
            <Clock />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-slate-400 text-sm">
              Bottom: Base floorplan (coming in later sprint).
            </span>
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}
