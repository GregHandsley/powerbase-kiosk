import type { MouseEvent } from 'react';
import type { BusyPeriod, SideUtilizationGraph } from '../types';

type ChartGraph = SideUtilizationGraph & { displaySeries: BusyPeriod[] };

type DayUtilisationPanelProps = {
  chartData: ChartGraph[];
  cardPad: string;
  showTooltip: (event: MouseEvent<HTMLElement>, lines: string[]) => void;
  moveTooltip: (event: MouseEvent<HTMLElement>) => void;
  hideTooltip: () => void;
};

export function DayUtilisationPanel({
  chartData,
  cardPad,
  showTooltip,
  moveTooltip,
  hideTooltip,
}: DayUtilisationPanelProps) {
  return (
    <section
      className={`min-h-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60 ${cardPad} flex flex-col`}
    >
      <h2 className="mb-2 text-sm font-semibold text-slate-200">
        Day Utilisation
      </h2>
      <div className="min-h-0 flex-1 overflow-auto pr-1">
        <div
          className="grid h-full min-h-0 gap-2"
          style={{
            gridTemplateRows: `repeat(${Math.max(chartData.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {chartData.map((graph) => {
            const labelStep =
              graph.displaySeries.length <= 10
                ? 1
                : Math.max(1, Math.floor(graph.displaySeries.length / 8));
            return (
              <div
                key={graph.sideId}
                className="min-h-0 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 flex flex-col"
              >
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">
                    {graph.sideName}
                  </span>
                  <span className="text-slate-500">
                    Avg {graph.avgUtilizationPct}%
                  </span>
                </div>
                {graph.displaySeries.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
                    No open periods.
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 items-end gap-[2px]">
                      {graph.displaySeries.map((point, idx) => (
                        <div
                          key={`${graph.sideId}-${point.time}-${idx}`}
                          className={`group relative flex-1 rounded-[2px] transition-transform duration-150 hover:z-10 hover:scale-[1.04] ${
                            point.isGeneralUser
                              ? 'bg-slate-500/60'
                              : 'bg-violet-400/75'
                          }`}
                          style={{
                            height: `${Math.max(8, Math.min(100, point.utilizationPct))}%`,
                          }}
                          onMouseEnter={(event) =>
                            showTooltip(event, [
                              `${graph.sideName} · ${point.time}`,
                              `Utilisation: ${point.utilizationPct}%`,
                              `Athletes: ${point.athletes}${
                                point.capacity > 0 ? ` / ${point.capacity}` : ''
                              }`,
                              ...(point.isGeneralUser
                                ? ['General User period']
                                : []),
                            ])
                          }
                          onMouseMove={moveTooltip}
                          onMouseLeave={hideTooltip}
                        />
                      ))}
                    </div>
                    <div className="mt-1.5 flex items-center gap-[2px] text-[10px] text-slate-500">
                      {graph.displaySeries.map((point, idx) => (
                        <div
                          key={`label-${graph.sideId}-${point.time}-${idx}`}
                          className="flex-1 text-center"
                        >
                          {(idx % labelStep === 0 ||
                            idx === graph.displaySeries.length - 1) && (
                            <span>{point.time}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {chartData.length === 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-500">
              No utilisation data for Power/Base today.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
