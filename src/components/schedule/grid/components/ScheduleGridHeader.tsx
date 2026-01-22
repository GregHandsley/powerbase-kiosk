type Props = {
  racks: number[];
  gridTemplateColumns: string;
};

export function ScheduleGridHeader({ racks, gridTemplateColumns }: Props) {
  return (
    <div
      className="sticky top-0 z-20 grid border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm"
      style={{ gridTemplateColumns }}
    >
      <div className="p-3 border-r border-slate-700 bg-indigo-500/10 min-w-[120px]"></div>
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
