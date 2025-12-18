// src/pages/Schedule.tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSnapshotFromSearchParams } from "../hooks/useSnapshotFromSearchParams";
import { Clock } from "../components/Clock";
import { RackListEditor } from "../components/schedule/RackListEditor";

type SideMode = "power" | "base";

export function Schedule() {
  const navigate = useNavigate();
  const {
    date,
    time,
    power,
    base,
    update,
    searchParams,
    setSearchParams,
  } = useSnapshotFromSearchParams();

  const sideParam = (searchParams.get("side") ?? "power").toLowerCase();
  const initialSide: SideMode = sideParam === "base" ? "base" : "power";

  const [sideMode, setSideMode] = useState<SideMode>(initialSide);
  const [timeInput, setTimeInput] = useState(time);

  // keep local time input in sync with URL-derived time
  useEffect(() => {
    setTimeInput(time);
  }, [time]);

  // keep URL side param in sync when toggling
  const setSideModeAndUrl = useCallback(
    (mode: SideMode) => {
      setSideMode(mode);
      const params = new URLSearchParams(searchParams);
      params.set("side", mode);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const handleDateChange = (newDate: string) => {
    const safeDate = newDate || date;
    update(safeDate, time);
  };

  const handleTimeChange = (newTime: string) => {
    setTimeInput(newTime);
    if (/^\d{2}:\d{2}$/.test(newTime)) {
      update(date, newTime);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1500);
    }
  };

  const selectedSnapshot = sideMode === "power" ? power : base;

  return (
    <div className="p-4 space-y-4">
      {/* Header / Controls */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Coach Schedule View</h1>
          <p className="text-sm text-slate-300">
            Read-only snapshot of platform allocations for a specific date and time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Date/time controls */}
          <div className="flex flex-col">
            <label className="mb-1 text-slate-300">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-slate-300">Time</label>
            <input
              type="time"
              value={timeInput}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Side toggle */}
          <div className="flex flex-col">
            <span className="mb-1 text-slate-300">Side</span>
            <div className="inline-flex rounded-md border border-slate-600 bg-slate-950 overflow-hidden">
              <button
                type="button"
                onClick={() => setSideModeAndUrl("power")}
                className={`px-2 py-1 ${sideMode === "power"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
                  }`}
              >
                Power
              </button>
              <button
                type="button"
                onClick={() => setSideModeAndUrl("base")}
                className={`px-2 py-1 ${sideMode === "base"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
                  }`}
              >
                Base
              </button>
            </div>
          </div>

          {/* Live clock */}
          <div className="flex flex-col">
            <span className="mb-1 text-slate-300">Now</span>
            <div className="px-2 py-1 rounded-md border border-slate-700 bg-slate-900 text-xs flex items-center gap-2">
              <Clock />
            </div>
          </div>

          {/* Copy link */}
          <div className="flex flex-col">
            <span className="mb-1 text-slate-300">Share</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1 rounded-md border border-slate-600 bg-slate-950 text-xs text-slate-100 hover:bg-slate-800"
            >
              {copyState === "copied"
                ? "Copied"
                : copyState === "error"
                  ? "Error"
                  : "Copy link"}
            </button>
          </div>

          {/* Add Booking button */}
          <div className="flex flex-col">
            <span className="mb-1 text-slate-300">Actions</span>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium"
            >
              Add Booking
            </button>
          </div>
        </div>
      </header>

      {/* Rack list editor */}
      <section className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold">
            {sideMode === "power" ? "Power" : "Base"} — {date} {time}
            </span>
            <span className="text-slate-400">
            Snapshot at {selectedSnapshot.snapshot?.at ?? "…"}
            </span>
          </div>
        <RackListEditor
          side={sideMode}
          snapshot={sideMode === "power" ? power.snapshot ?? null : base.snapshot ?? null}
        />
      </section>
    </div>
  );
}
