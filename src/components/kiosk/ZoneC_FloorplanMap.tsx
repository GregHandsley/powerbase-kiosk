import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { SideSnapshot } from '../../types/snapshot';
import { BaseFloorplan } from '../floorplans/base/BaseFloorplan';
import { PowerbaseFloorSvg } from '../floorplans/power/PowerFloorplan';
import type { SideKey } from '../../nodes/data/sidesNodes';

type Props = {
  sideKey: SideKey;
  snapshot: SideSnapshot | null;
  visiblePlatformIds: number[];
  isLoading?: boolean;
  error?: string | null;
};

const FloorplanMapComponent = function FloorplanMap({
  sideKey,
  snapshot,
  visiblePlatformIds,
  isLoading = false,
  error = null,
}: Props) {
  const FloorplanComponent =
    sideKey === 'Base' ? BaseFloorplan : PowerbaseFloorSvg;
  const isBase = sideKey === 'Base';

  const highlightedRacks = useMemo(
    () => new Set(visiblePlatformIds),
    [visiblePlatformIds]
  );
  const currentKey = `${snapshot?.at ?? ''}|${visiblePlatformIds.join(',')}`;
  const lastKeyRef = useRef(currentKey);
  const [frontSnapshot, setFrontSnapshot] = useState<SideSnapshot | null>(
    snapshot
  );
  const [frontHighlights, setFrontHighlights] =
    useState<Set<number>>(highlightedRacks);
  const [backSnapshot, setBackSnapshot] = useState<SideSnapshot | null>(null);
  const [backHighlights, setBackHighlights] = useState<Set<number> | null>(
    null
  );

  useEffect(() => {
    if (!snapshot) return;
    if (lastKeyRef.current === currentKey) return;

    lastKeyRef.current = currentKey;
    setBackSnapshot(snapshot);
    setBackHighlights(highlightedRacks);

    const timeout = window.setTimeout(() => {
      setFrontSnapshot(snapshot);
      setFrontHighlights(highlightedRacks);
      setBackSnapshot(null);
      setBackHighlights(null);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [currentKey, highlightedRacks, snapshot]);

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="text-sm text-red-400">
          Error loading floorplan: {error}
        </div>
      </div>
    );
  }

  if (isLoading || !snapshot || !frontSnapshot) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="text-sm text-slate-400">Loading floorplan...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full kiosk-floorplan relative">
      {isBase && (
        <div className="absolute inset-0">
          <BaseFloorplan
            snapshot={null}
            appearance="status-board"
            highlightedRacks={new Set()}
            renderShell={true}
            renderRacks={true}
            rackRenderMode="chrome"
          />
        </div>
      )}
      <div className="absolute inset-0">
        {isBase ? (
          <BaseFloorplan
            snapshot={frontSnapshot}
            appearance="status-board"
            highlightedRacks={frontHighlights}
            renderShell={false}
            renderRacks={true}
            rackRenderMode="content"
          />
        ) : (
          <FloorplanComponent
            snapshot={frontSnapshot}
            appearance="status-board"
            highlightedRacks={frontHighlights}
          />
        )}
      </div>
      {backSnapshot && backHighlights && (
        <div className="absolute inset-0 opacity-0 pointer-events-none">
          {isBase ? (
            <BaseFloorplan
              snapshot={backSnapshot}
              appearance="status-board"
              highlightedRacks={backHighlights}
              renderShell={false}
              renderRacks={true}
              rackRenderMode="content"
            />
          ) : (
            <FloorplanComponent
              snapshot={backSnapshot}
              appearance="status-board"
              highlightedRacks={backHighlights}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const FloorplanMap = memo(FloorplanMapComponent);
