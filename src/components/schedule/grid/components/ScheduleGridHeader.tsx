type Props = {
  racks: number[];
  gridTemplateColumns: string;
};

export function ScheduleGridHeader({ racks, gridTemplateColumns }: Props) {
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
      {racks.map((rack) => (
        <div
          key={rack}
          className="p-3 border-r border-slate-700 last:border-r-0 bg-indigo-500/10 text-center min-w-[120px]"
        >
          <div className="text-sm font-semibold text-slate-100">
            Rack {rack}
          </div>
        </div>
      ))}
    </div>
  );
}
