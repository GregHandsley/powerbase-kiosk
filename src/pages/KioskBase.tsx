import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";

export function KioskBase() {
  return (
    <div className="p-4">
      <AspectRatio ratio={16 / 9}>
        <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4 text-xs text-slate-300">
            <span className="font-semibold tracking-wide">Base — Live Kiosk</span>
            <Clock />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-slate-400 text-sm">
              Kiosk Base – floorplan will render here.
            </span>
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}
