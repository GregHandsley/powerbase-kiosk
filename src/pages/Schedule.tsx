import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";

export function Schedule() {
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-2">Coach Schedule View</h1>
      <p className="text-slate-300 text-sm mb-4">
        This will become the read-only snapshot view for coaches, driven by date/time
        query parameters.
      </p>

      <AspectRatio ratio={16 / 9}>
        <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4 text-xs text-slate-300">
            <span className="font-semibold tracking-wide">Schedule Snapshot</span>
            <Clock />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-slate-400 text-sm">
              Snapshot content will render here in a later sprint.
            </span>
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}
