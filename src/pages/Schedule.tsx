// src/pages/Schedule.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSnapshotFromSearchParams } from "../hooks/useSnapshotFromSearchParams";
import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";
import { POWER_LAYOUT, BASE_LAYOUT } from "../config/layout";
import { SideFloorplan } from "../components/SideFloorplan";
import type { ActiveInstance, SideSnapshot } from "../types/snapshot";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

type SideMode = "both" | "power" | "base";

function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return `${startIso} → ${endIso}`;
  }
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${s.toLocaleTimeString("en-GB", opts)} → ${e.toLocaleTimeString(
    "en-GB",
    opts
  )}`;
}

function sortInstances(instances: ActiveInstance[]): ActiveInstance[] {
  return [...instances].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

export function Schedule() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const {
    date,
    time,
    power,
    base,
    update,
    searchParams,
    setSearchParams,
  } = useSnapshotFromSearchParams();

  const sideParam = (searchParams.get("side") ?? "both").toLowerCase();
  const initialSide: SideMode =
    sideParam === "power" || sideParam === "base" ? (sideParam as SideMode) : "both";

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

  const powerInstances = useMemo(
    () => sortInstances(power.snapshot?.currentInstances ?? []),
    [power.snapshot]
  );
  const baseInstances = useMemo(
    () => sortInstances(base.snapshot?.currentInstances ?? []),
    [base.snapshot]
  );

  const showPower = sideMode === "both" || sideMode === "power";
  const showBase = sideMode === "both" || sideMode === "base";

  const canEditInstance = useCallback(
    (inst: ActiveInstance) => {
      if (!user) return false;
      // Admins always can edit
      if (role === "admin") return true;
      // Coaches can edit if not locked
      if (role === "coach") {
        return !inst.isLocked;
      }
      // Fallback: if role hasn't loaded yet but user is present and booking is unlocked,
      // allow edit so coaches who haven't synced profile role yet can still act.
      if (!role && !inst.isLocked) return true;
      return false;
    },
    [role, user]
  );

  const handleEditInstance = useCallback(
    async (inst: ActiveInstance) => {
      console.log("Attempting to edit instance:", {
        instanceId: inst.instanceId,
        bookingId: inst.bookingId,
        role,
        uid: user?.id
      });
      const current = inst.racks.join(", ");
      const next = window.prompt("Enter rack numbers (comma-separated)", current);
      if (next === null) return;
      const parsed = next
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n));
      if (!parsed.length) return;
      const deduped = Array.from(new Set(parsed)).sort((a, b) => a - b);

      const { data, error } = await supabase
        .from("booking_instances")
        .update({ racks: deduped })
        .eq("id", inst.instanceId)
        .select();

      if (error) {
        console.error("updateInstanceRacks error", error.message);
        window.alert(`Update failed: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error("updateInstanceRacks: No rows updated (likely permission/RLS issue)");
        window.alert("Update failed: You may not have permission to edit this booking.");
        return;
      }

      // Optimistically update any cached snapshots
      queryClient.setQueriesData(
        { queryKey: ["snapshot"], exact: false },
        (oldData: unknown) => {
          if (!oldData) return oldData;
          const snap = oldData as SideSnapshot;
          if (!snap?.currentInstances) return oldData;
          return {
            ...snap,
            currentInstances: snap.currentInstances.map((ci: ActiveInstance) =>
              ci.instanceId === inst.instanceId ? { ...ci, racks: deduped } : ci
            ),
          };
        }
      );

      // Also invalidate to refetch from server
      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({
        queryKey: ["booking-instances-debug"],
        exact: false,
      });
    },
    [queryClient, role, user?.id]
  );

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
                onClick={() => setSideModeAndUrl("both")}
                className={`px-2 py-1 ${sideMode === "both"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
                  }`}
              >
                Both
              </button>
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
        </div>
      </header>

      {/* Power section */}
      {showPower && (
        <section className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold">
              Power — {date} {time}
            </span>
            <span className="text-slate-400">
              Snapshot at {power.snapshot?.at ?? "…"}
            </span>
          </div>
          <AspectRatio ratio={16 / 9}>
            <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col">
              <div className="flex-1 min-h-0">
                {power.isLoading && !power.snapshot ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    Loading Power snapshot…
                  </div>
                ) : (
                  <SideFloorplan
                    layout={POWER_LAYOUT}
                    snapshot={power.snapshot}
                    canEditInstance={canEditInstance}
                    onEditInstance={handleEditInstance}
                  />
                )}
              </div>
            </div>
          </AspectRatio>
          <div className="text-xs text-slate-200">
            <h2 className="font-semibold mb-1">Active bookings (Power)</h2>
            {powerInstances.length === 0 ? (
              <p className="text-slate-400">No active bookings at this time.</p>
            ) : (
              <ul className="space-y-0.5">
                {powerInstances.map((inst) => (
                  <li key={inst.instanceId} className="flex flex-wrap gap-2">
                    <span className="font-medium">{inst.title}</span>
                    <span className="text-slate-300">
                      — Racks {inst.racks.join(", ")}
                    </span>
                    <span className="text-slate-400">
                      ({formatTimeRange(inst.start, inst.end)})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Base section */}
      {showBase && (
        <section className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold">
              Base — {date} {time}
            </span>
            <span className="text-slate-400">
              Snapshot at {base.snapshot?.at ?? "…"}
            </span>
          </div>
          <AspectRatio ratio={16 / 9}>
            <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col">
              <div className="flex-1 min-h-0">
                {base.isLoading && !base.snapshot ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    Loading Base snapshot…
                  </div>
                ) : (
                  <SideFloorplan
                    layout={BASE_LAYOUT}
                    snapshot={base.snapshot}
                    canEditInstance={canEditInstance}
                    onEditInstance={handleEditInstance}
                  />
                )}
              </div>
            </div>
          </AspectRatio>
          <div className="text-xs text-slate-200">
            <h2 className="font-semibold mb-1">Active bookings (Base)</h2>
            {baseInstances.length === 0 ? (
              <p className="text-slate-400">No active bookings at this time.</p>
            ) : (
              <ul className="space-y-0.5">
                {baseInstances.map((inst) => (
                  <li key={inst.instanceId} className="flex flex-wrap gap-2">
                    <span className="font-medium">{inst.title}</span>
                    <span className="text-slate-300">
                      — Racks {inst.racks.join(", ")}
                    </span>
                    <span className="text-slate-400">
                      ({formatTimeRange(inst.start, inst.end)})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
