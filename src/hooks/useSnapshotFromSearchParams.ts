// src/hooks/useSnapshotFromSearchParams.ts
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSideSnapshot } from './useSideSnapshot';
import {
  todayString,
  currentTimeString,
  combineDateTime,
} from '../lib/datetime';

export function useSnapshotFromSearchParams() {
  const [search, setSearch] = useSearchParams();
  const hasInitialized = useRef(false);

  // When navigating from nav (no date/time in URL), set date/time to current so Session View shows "now".
  // When navigating from My Bookings (e.g. View session with ?date=...&time=...), preserve those params.
  useEffect(() => {
    if (hasInitialized.current) return;

    const dateParam = search.get('date');
    const timeParam = search.get('time');
    const hasValidDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
    const hasValidTime = timeParam && /^\d{2}:\d{2}$/.test(timeParam);

    if (hasValidDate && hasValidTime) {
      hasInitialized.current = true;
      return;
    }

    const params = new URLSearchParams(search);
    if (!hasValidDate) params.set('date', todayString());
    if (!hasValidTime) params.set('time', currentTimeString());
    setSearch(params, { replace: true });

    hasInitialized.current = true;
  }, [search, setSearch]);

  const dateParam = search.get('date');
  const timeParam = search.get('time');

  const date = dateParam ?? todayString();
  const time =
    timeParam && /^\d{2}:\d{2}$/.test(timeParam)
      ? timeParam
      : currentTimeString();

  const at = useMemo(() => combineDateTime(date, time), [date, time]);

  const {
    snapshot: powerSnapshot,
    error: powerError,
    isLoading: powerLoading,
  } = useSideSnapshot('Power', at);

  const {
    snapshot: baseSnapshot,
    error: baseError,
    isLoading: baseLoading,
  } = useSideSnapshot('Base', at);

  function update(newDate: string, newTime: string) {
    const params = new URLSearchParams(search);
    params.set('date', newDate);
    params.set('time', newTime);
    setSearch(params, { replace: true });
  }

  return {
    date,
    time,
    at,
    power: {
      snapshot: powerSnapshot,
      error: powerError,
      isLoading: powerLoading,
    },
    base: { snapshot: baseSnapshot, error: baseError, isLoading: baseLoading },
    update,
    searchParams: search,
    setSearchParams: setSearch,
  };
}
