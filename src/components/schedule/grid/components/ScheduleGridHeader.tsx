import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getRackOrPlatformLabel,
  isOpenPlatform,
} from '../../utils/platformUtils';

type Props = {
  racks: number[];
  selectedSide: 'Power' | 'Base';
  gridTemplateColumns: string;
  viewMode?: 'master' | 'platforms';
};

/** Tooltip styling to match home screen */
const OPEN_PLATFORM_TOOLTIP_CLASS =
  'pointer-events-none fixed z-[200] min-w-[160px] rounded-md border border-indigo-300/70 bg-slate-950 px-2.5 py-1.5 text-[10px] text-slate-100 shadow-[0_10px_24px_rgba(2,6,23,0.85)] ring-1 ring-indigo-400/30';

export function ScheduleGridHeader({
  racks,
  selectedSide,
  gridTemplateColumns,
  viewMode = 'platforms',
}: Props) {
  const sideKey = selectedSide === 'Power' ? 'power' : 'base';
  const [tooltip, setTooltip] = useState<{
    rack: number;
    x: number;
    y: number;
  } | null>(null);

  const handleIconEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>, rack: number) => {
      if (!isOpenPlatform(sideKey, rack)) return;
      e.stopPropagation();
      setTooltip({ rack, x: e.clientX, y: e.clientY });
    },
    [sideKey]
  );

  const handleIconMove = useCallback(
    (e: React.MouseEvent<HTMLElement>, rack: number) => {
      if (!isOpenPlatform(sideKey, rack) || !tooltip || tooltip.rack !== rack)
        return;
      setTooltip((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY } : null
      );
    },
    [sideKey, tooltip]
  );

  const handleIconLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div
      className="sticky top-0 z-30 grid border-b border-slate-700 bg-slate-900/90 backdrop-blur-sm"
      style={{ gridTemplateColumns }}
    >
      <div className="sticky left-0 z-40 relative p-3 border-r border-slate-700 bg-slate-950/99 backdrop-blur-md min-w-[120px]">
        <div className="pointer-events-none absolute inset-0 bg-slate-950/25" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-r from-transparent to-slate-950/72" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-slate-300/12" />
      </div>
      {viewMode === 'master' ? (
        <div
          className="border-r border-slate-700 border-l-0 bg-slate-900/90 min-w-0"
          style={{ gridColumn: '2 / -1' }}
        />
      ) : (
        racks.map((rack) => {
          const label = getRackOrPlatformLabel(sideKey, rack);
          const showTooltipIcon = isOpenPlatform(sideKey, rack);
          return (
            <div
              key={rack}
              className="p-3 border-r border-slate-700 last:border-r-0 bg-indigo-500/10 text-center min-w-[120px]"
            >
              <div className="text-sm font-semibold text-slate-100 flex items-center justify-center gap-1">
                <span>{label}</span>
                {showTooltipIcon && (
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-600/80 text-slate-300 text-xs font-normal flex-shrink-0"
                    aria-label="Open platform without a rack"
                    onMouseEnter={(e) => handleIconEnter(e, rack)}
                    onMouseMove={(e) => handleIconMove(e, rack)}
                    onMouseLeave={handleIconLeave}
                  >
                    i
                  </span>
                )}
              </div>
              {tooltip?.rack === rack &&
                createPortal(
                  <div
                    className={OPEN_PLATFORM_TOOLTIP_CLASS}
                    style={{
                      left: tooltip.x + 12,
                      top: tooltip.y - 12,
                      transform: 'translateY(-100%)',
                    }}
                  >
                    <div className="font-semibold">
                      Open platform without a rack
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          );
        })
      )}
    </div>
  );
}
