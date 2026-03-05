import type { AreaSlotInput } from '../../../nodes/data/areaSlotsNodes';

type AreaOption = { id: number; side_id: number; key: string; name: string };

type Props = {
  areas: AreaOption[];
  /** Booking window start time (HH:mm) for validation */
  windowStartTime: string;
  /** Booking window end time (HH:mm) for validation */
  windowEndTime: string;
  value: AreaSlotInput[];
  onChange: (slots: AreaSlotInput[]) => void;
  disabled?: boolean;
  /** For create flow, slot times are just HH:mm; we build ISO with startDate on submit */
  slotTimeMode: 'time-only'; // future: 'datetime' if we need per-day slots
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t);
}

export function AreaSlotsField({
  areas,
  windowStartTime,
  windowEndTime,
  value,
  onChange,
  disabled = false,
}: Props) {
  const addSlot = () => {
    const firstArea = areas[0];
    onChange([
      ...value,
      {
        area_key: firstArea?.key ?? '',
        start: windowStartTime,
        end: windowEndTime,
      },
    ]);
  };

  const updateSlot = (index: number, patch: Partial<AreaSlotInput>) => {
    const next = [...value];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  };

  const removeSlot = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const windowStartMin = timeToMinutes(windowStartTime);
  const windowEndMin = timeToMinutes(windowEndTime);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block font-medium">Area slots (optional)</label>
        {!disabled && (
          <button
            type="button"
            onClick={addSlot}
            className="text-xs rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200 hover:bg-slate-700"
          >
            Add slot
          </button>
        )}
      </div>
      <p className="text-[10px] text-slate-500">
        Allocate areas with a time range within this booking. Same slot can be
        used for multiple areas (e.g. cardio 09:00–09:30, platforms
        09:30–10:00).
      </p>
      <div className="space-y-2 max-h-48 overflow-auto">
        {value.length === 0 && (
          <p className="text-[11px] text-slate-500 italic">
            No area slots. Click &quot;Add slot&quot; to add one.
          </p>
        )}
        {value.map((slot, index) => {
          const startMin = timeToMinutes(slot.start);
          const endMin = timeToMinutes(slot.end);
          const startValid =
            isValidTime(slot.start) &&
            startMin >= windowStartMin &&
            startMin <= windowEndMin;
          const endValid =
            isValidTime(slot.end) &&
            endMin > startMin &&
            endMin <= windowEndMin;
          const areaValid = !!slot.area_key;
          return (
            <div
              key={index}
              className="flex flex-wrap items-end gap-2 rounded-md border border-slate-700 bg-slate-950/80 p-2"
            >
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] text-slate-500 mb-0.5">
                  Area
                </label>
                <select
                  value={slot.area_key}
                  onChange={(e) =>
                    updateSlot(index, { area_key: e.target.value })
                  }
                  disabled={disabled}
                  className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                >
                  <option value="">Select area</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.key}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {!areaValid && value[index] && (
                  <p className="text-[10px] text-amber-400 mt-0.5">
                    Select an area
                  </p>
                )}
              </div>
              <div className="w-20">
                <label className="block text-[10px] text-slate-500 mb-0.5">
                  Start
                </label>
                <input
                  type="time"
                  value={slot.start}
                  onChange={(e) => updateSlot(index, { start: e.target.value })}
                  disabled={disabled}
                  step={900}
                  className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                />
                {!startValid && value[index] && (
                  <p className="text-[10px] text-amber-400 mt-0.5">
                    Within {windowStartTime}–{windowEndTime}
                  </p>
                )}
              </div>
              <div className="w-20">
                <label className="block text-[10px] text-slate-500 mb-0.5">
                  End
                </label>
                <input
                  type="time"
                  value={slot.end}
                  onChange={(e) => updateSlot(index, { end: e.target.value })}
                  disabled={disabled}
                  step={900}
                  className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                />
                {!endValid && value[index] && (
                  <p className="text-[10px] text-amber-400 mt-0.5">
                    After start, within window
                  </p>
                )}
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeSlot(index)}
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-red-900/40 hover:text-red-200"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
