import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AspectRatio } from '../components/AspectRatio';
import { useSideSnapshot } from '../hooks/useSideSnapshot';
import { PowerbaseFloorSvg } from '../components/floorplans/power/PowerFloorplan';
import { parseRatioParam } from '../lib/parseRatio';
import { useInstancesRealtime } from '../hooks/useInstancesRealtime';
import { KioskFrame } from '../components/KioskFrame';

export function KioskPower() {
  const [search] = useSearchParams();
  const ratio = parseRatioParam(search.get('ratio'), 16 / 9);
  const { snapshot, error, isLoading } = useSideSnapshot('Power');
  useInstancesRealtime();

  const first = snapshot?.currentInstances?.[0];
  const slotLabel =
    first && first.start && first.end
      ? `${format(new Date(first.start), 'HH:mm')}–${format(new Date(first.end), 'HH:mm')}`
      : null;

  return (
    <KioskFrame title="Power" slotLabel={slotLabel} sideKey="Power">
      <AspectRatio ratio={ratio}>
        <div className="w-full h-full kiosk-floorplan">
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
                <PowerbaseFloorSvg snapshot={snapshot} appearance="kiosk" />
              )}
            </div>
          )}
        </div>
      </AspectRatio>
    </KioskFrame>
  );
}
