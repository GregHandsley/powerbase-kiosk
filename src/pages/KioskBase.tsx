import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { AspectRatio } from "../components/AspectRatio";
import { useSideSnapshot } from "../hooks/useSideSnapshot";
import { BaseFloorplan } from "../components/floorplans/base/BaseFloorplan";
import { parseRatioParam } from "../lib/parseRatio";
import { KioskHeader } from "../components/KioskHeader";
import { useInstancesRealtime } from "../hooks/useInstancesRealtime";

export function KioskBase() {
  const [search] = useSearchParams();
  const ratio = parseRatioParam(search.get("ratio"), 16 / 9);
  const { snapshot, error, isLoading } = useSideSnapshot("Base");
  useInstancesRealtime();

  const first = snapshot?.currentInstances?.[0];
  const slotLabel =
    first && first.start && first.end
      ? `${format(new Date(first.start), "HH:mm")}–${format(new Date(first.end), "HH:mm")}`
      : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-50 kiosk-page">
      <KioskHeader title="Base" slotLabel={slotLabel} />
      <div className="flex-1 kiosk-gradient flex items-center justify-center px-4 py-3">
        <AspectRatio ratio={ratio}>
          <div className="w-full h-full bg-slate-900/70 border border-slate-700 rounded-xl p-4">
            {error && (
              <div className="w-full h-full flex items-center justify-center text-xs text-red-400">
                Error loading snapshot: {error}
              </div>
            )}
            {!error && (
              <div className="w-full h-full">
                {isLoading && !snapshot ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    Loading snapshot...
                  </div>
                ) : (
                  <BaseFloorplan snapshot={snapshot} />
                )}
              </div>
            )}
          </div>
        </AspectRatio>
      </div>
    </div>
  );
}
