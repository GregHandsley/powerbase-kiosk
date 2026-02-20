import type { MouseEvent } from 'react';
import type { SideRackHeatmap } from '../types';
import { getHeatLayout, getRackHeatColor } from '../utils';

type RackUtilisationMapPanelProps = {
  rackHeatmaps: SideRackHeatmap[];
  cardPad: string;
  showTooltip: (event: MouseEvent<HTMLElement>, lines: string[]) => void;
  moveTooltip: (event: MouseEvent<HTMLElement>) => void;
  hideTooltip: () => void;
};

export function RackUtilisationMapPanel({
  rackHeatmaps,
  cardPad,
  showTooltip,
  moveTooltip,
  hideTooltip,
}: RackUtilisationMapPanelProps) {
  return (
    <section
      className={`min-h-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60 ${cardPad} flex flex-col`}
    >
      <h2 className="mb-2 text-sm font-semibold text-slate-200">
        Rack Utilisation Map
      </h2>
      <div className="min-h-0 flex-1 overflow-auto pr-1">
        <div className="flex h-full min-h-0 flex-col gap-2">
          {rackHeatmaps.map((sideMap) => (
            <div
              key={`rack-heat-${sideMap.sideKey}`}
              className="min-h-0 flex flex-1 flex-col rounded-lg border border-slate-800 bg-slate-950/70 p-2.5"
            >
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-200">
                  {sideMap.sideName}
                </span>
              </div>
              {sideMap.cells.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-slate-500">
                  No racks configured.
                </div>
              ) : (
                <div className="min-h-0 flex-1">
                  {(() => {
                    const layout = getHeatLayout(sideMap.sideKey);
                    const rackCellMap = new Map(
                      sideMap.cells.map(
                        (cell) => [cell.rackNumber, cell] as const
                      )
                    );

                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: layout.gridTemplateColumns,
                          gridTemplateRows: `repeat(${layout.numRows}, minmax(0, 1fr))`,
                          columnGap: '3px',
                          rowGap: '3px',
                          padding: '3px',
                          height: '100%',
                        }}
                      >
                        {layout.showBanner && (
                          <div
                            style={{
                              gridColumn: 3,
                              gridRow: layout.bannerRowSpan,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              writingMode: 'vertical-rl',
                              textOrientation: 'mixed',
                              fontSize: '8px',
                              letterSpacing: '0.08em',
                              color: 'rgba(148, 163, 184, 0.55)',
                              fontWeight: 600,
                            }}
                          >
                            WHERE HISTORY BEGINS
                          </div>
                        )}
                        {layout.rows.map((row) => {
                          if (row.rackNumber === null) {
                            return (
                              <div
                                key={`${sideMap.sideKey}-${row.id}`}
                                style={{
                                  gridColumn: row.gridColumn,
                                  gridRow: row.gridRow,
                                }}
                                className="rounded-sm border border-slate-800/40 bg-slate-900/30"
                              />
                            );
                          }

                          const cell = rackCellMap.get(row.rackNumber);
                          const occupancyPct = cell?.occupancyPct ?? 0;
                          const bookableSlots = cell?.bookableSlots ?? 0;

                          return (
                            <div
                              key={`${sideMap.sideKey}-${row.id}`}
                              style={{
                                gridColumn: row.gridColumn,
                                gridRow: row.gridRow,
                                backgroundColor:
                                  bookableSlots > 0
                                    ? getRackHeatColor(occupancyPct)
                                    : 'rgba(51, 65, 85, 0.7)',
                              }}
                              className="group relative flex h-full min-h-[20px] items-center justify-center rounded-sm border border-slate-800/80 transition-transform duration-150 hover:z-10 hover:scale-[1.04]"
                              onMouseEnter={(event) =>
                                showTooltip(event, [
                                  `${sideMap.sideName} · Rack ${row.rackNumber}`,
                                  `Occupancy: ${occupancyPct}%`,
                                  ...(bookableSlots === 0
                                    ? ['No performance-bookable periods today']
                                    : []),
                                ])
                              }
                              onMouseMove={moveTooltip}
                              onMouseLeave={hideTooltip}
                            >
                              <span className="text-[9px] font-semibold leading-none text-slate-100/90">
                                {row.rackNumber}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
