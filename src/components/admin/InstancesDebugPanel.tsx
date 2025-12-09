import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

type DebugInstanceRow = {
  id: number;
  side_id: number;
  start: string;
  end: string;
  racks: number[];
  areas: string[];
  booking: {
    title: string | null;
    color: string | null;
  } | null;
};

type RawDebugInstanceRow = {
  id: number;
  side_id: number;
  start: string;
  end: string;
  racks?: unknown;
  areas?: unknown;
  booking?:
    | { title?: unknown; color?: unknown }
    | { title?: unknown; color?: unknown }[]
    | null;
};

function normalizeInstance(row: RawDebugInstanceRow): DebugInstanceRow {
  const bookingRaw = row.booking ?? null;
  const bookingObj = Array.isArray(bookingRaw) ? bookingRaw[0] ?? null : bookingRaw;

  return {
    id: row.id,
    side_id: row.side_id,
    start: row.start,
    end: row.end,
    racks: Array.isArray(row.racks) ? row.racks : [],
    areas: Array.isArray(row.areas) ? row.areas : [],
    booking: bookingObj
      ? {
          title:
            typeof bookingObj.title === "string" || bookingObj.title === null
              ? bookingObj.title
              : null,
          color:
            typeof bookingObj.color === "string" || bookingObj.color === null
              ? bookingObj.color
              : null,
        }
      : null,
  };
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export function InstancesDebugPanel() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["booking-instances-debug"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_instances")
        .select(
          `
          id,
          side_id,
          start,
          "end",
          racks,
          areas,
          booking:bookings (
            title,
            color
          )
        `
        )
        .gte("start", new Date().toISOString())
        .order("start", { ascending: true })
        .limit(30);

      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map(normalizeInstance);
    },
    refetchInterval: 20_000,
  });

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Upcoming Instances (debug)</h2>
        <span className="text-[10px] text-slate-400">Next 30</span>
      </div>

      {isLoading && !data && (
        <p className="text-xs text-slate-400">Loading instances…</p>
      )}
      {error && (
        <p className="text-xs text-red-400">
          Error loading instances: {error.message}
        </p>
      )}

      {data && data.length === 0 && (
        <p className="text-xs text-slate-400">No upcoming instances.</p>
      )}

      {data && data.length > 0 && (
        <div className="max-h-60 overflow-auto text-[11px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-slate-900/95">
              <tr className="border-b border-slate-700 text-slate-300">
                <th className="text-left py-1 pr-2">When</th>
                <th className="text-left py-1 pr-2">Side</th>
                <th className="text-left py-1 pr-2">Title</th>
                <th className="text-left py-1 pr-2">Racks</th>
                <th className="text-left py-1 pr-2">Areas</th>
              </tr>
            </thead>
            <tbody>
              {data.map((inst) => (
                <tr key={inst.id} className="border-b border-slate-800/60">
                  <td className="py-1 pr-2 text-slate-200">
                    {formatTime(inst.start)} → {formatTime(inst.end)}
                  </td>
                  <td className="py-1 pr-2 text-slate-300">
                    {inst.side_id}
                  </td>
                  <td className="py-1 pr-2 text-slate-200">
                    {inst.booking?.title ?? "Untitled"}
                  </td>
                  <td className="py-1 pr-2 text-slate-300">
                    {inst.racks?.join(", ") ?? "—"}
                  </td>
                  <td className="py-1 pr-2 text-slate-300">
                    {inst.areas?.join(", ") ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
