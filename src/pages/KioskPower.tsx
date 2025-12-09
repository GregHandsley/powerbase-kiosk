import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";
import { useSideSnapshot } from "../hooks/useSideSnapshot";
import type { ActiveInstance } from "../types/snapshot";

export function KioskPower() {
  const { snapshot, error, isLoading } = useSideSnapshot("Power");

  return (
    <div className="p-4">
      <AspectRatio ratio={16 / 9}>
        <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-300">
            <span className="font-semibold tracking-wide">Power — Live Kiosk</span>
            <Clock />
          </div>

          <p className="text-[10px] text-slate-400 mb-2">
            at: {snapshot?.at ?? "loading..."}
          </p>

          {error && (
            <p className="text-xs text-red-400 mb-2">
              Error loading snapshot: {error}
            </p>
          )}

          <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
            <div className="flex flex-col min-w-0">
              <h2 className="text-xs font-semibold text-slate-100 mb-1">
                Current Instances
              </h2>
              <div className="flex-1 overflow-auto text-[11px]">
                {isLoading && !snapshot && (
                  <p className="text-slate-400">Loading...</p>
                )}
                {snapshot && snapshot.currentInstances.length === 0 && (
                  <p className="text-slate-400">No active bookings.</p>
                )}
                {snapshot && snapshot.currentInstances.length > 0 && (
                  <ul className="space-y-1">
                    {snapshot.currentInstances.map((inst: ActiveInstance) => (
                      <li key={inst.id} className="text-slate-200">
                        <span className="font-mono">
                          {inst.start} → {inst.end}
                        </span>
                        <br />
                        <span className="text-slate-400">
                          racks {inst.racks.join(", ") || "—"} | areas{" "}
                          {inst.areas.join(", ") || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <h2 className="text-xs font-semibold text-slate-100 mb-1">
                Next use by rack
              </h2>
              <div className="flex-1 overflow-auto bg-slate-950/60 rounded-md border border-slate-800 p-2">
                <pre className="text-[10px] text-slate-300 whitespace-pre-wrap">
                  {snapshot
                    ? JSON.stringify(snapshot.nextUseByRack, null, 2)
                    : isLoading
                    ? "loading..."
                    : "{}"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}
