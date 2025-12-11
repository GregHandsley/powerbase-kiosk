import { PowerbaseFloorSvg } from "../components/floorplans/power/PowerbaseFloorSvg";

export function TestLayout() {
  return (
    <div className="p-4 space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Layout Test</h1>
        <p className="text-sm text-slate-300">
          Preview the new facility layout SVG (Powerbase).
        </p>
      </header>

      <div className="border border-slate-700 rounded-lg bg-slate-950 p-3 min-h-[320px]">
        <PowerbaseFloorSvg />
      </div>
    </div>
  );
}

