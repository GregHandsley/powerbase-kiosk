import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AspectRatio } from '../components/AspectRatio';
import { useSideSnapshot } from '../hooks/useSideSnapshot';
import { BaseFloorplan } from '../components/floorplans/base/BaseFloorplan';
import { parseRatioParam } from '../lib/parseRatio';
import { useInstancesRealtime } from '../hooks/useInstancesRealtime';
import { KioskFrame } from '../components/KioskFrame';

export function KioskBase() {
  const [search] = useSearchParams();
  const ratio = parseRatioParam(search.get('ratio'), 16 / 9);
  const { snapshot, error, isLoading } = useSideSnapshot('Base');
  useInstancesRealtime();

  const first = snapshot?.currentInstances?.[0];
  const slotLabel =
    first && first.start && first.end
      ? `${format(new Date(first.start), 'HH:mm')}–${format(new Date(first.end), 'HH:mm')}`
      : null;

  return (
    <KioskFrame title="Base" slotLabel={slotLabel}>
      <AspectRatio ratio={ratio}>
        <div className="w-full h-full bg-slate-900/70 border border-slate-800 rounded-xl md:p-3">
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
    </KioskFrame>
  );
}
