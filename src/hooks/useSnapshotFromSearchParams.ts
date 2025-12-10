// src/hooks/useSnapshotFromSearchParams.ts
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useSideSnapshot } from "./useSideSnapshot";
import { todayString, currentTimeString, combineDateTime } from "../lib/datetime";

export function useSnapshotFromSearchParams() {
  const [search, setSearch] = useSearchParams();

  const dateParam = search.get("date");
  const timeParam = search.get("time");

  const date = dateParam ?? todayString();
  const time =
    timeParam && /^\d{2}:\d{2}$/.test(timeParam) ? timeParam : currentTimeString();

  const at = useMemo(() => combineDateTime(date, time), [date, time]);

  const { snapshot: powerSnapshot, error: powerError, isLoading: powerLoading } =
    useSideSnapshot("Power", at);

  const { snapshot: baseSnapshot, error: baseError, isLoading: baseLoading } =
    useSideSnapshot("Base", at);

  function update(newDate: string, newTime: string) {
    const params = new URLSearchParams(search);
    params.set("date", newDate);
    params.set("time", newTime);
    setSearch(params, { replace: true });
  }

  return {
    date,
    time,
    at,
    power: { snapshot: powerSnapshot, error: powerError, isLoading: powerLoading },
    base: { snapshot: baseSnapshot, error: baseError, isLoading: baseLoading },
    update,
    searchParams: search,
    setSearchParams: setSearch,
  };
}