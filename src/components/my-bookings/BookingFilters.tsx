import { useState, useEffect, useRef } from 'react';
import type { BookingFilter } from '../../hooks/useMyBookings';
import type { BookingStatus } from '../../types/db';
import { format } from 'date-fns';

/** Status options for My Bookings filter. Excludes 'confirmed' as it is not used. */
const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processed', label: 'Processed' },
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending_cancellation', label: 'Pending cancellation' },
  { value: 'cancelled', label: 'Cancelled' },
];

type Props = {
  filters: BookingFilter;
  onFiltersChange: (filters: BookingFilter) => void;
  /** When set, "Clear all" resets to this instead of status-only default. */
  defaultFilters?: BookingFilter;
};

export function BookingFilters({
  filters,
  onFiltersChange,
  defaultFilters,
}: Props) {
  const [localFilters, setLocalFilters] = useState<BookingFilter>(filters);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (!statusDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      ) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusDropdownOpen]);

  const handleStatusToggle = (status: BookingStatus) => {
    const current = localFilters.status ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    const newFilters = { ...localFilters, status: next };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleSideChange = (side: 'Power' | 'Base' | 'all') => {
    const newFilters = { ...localFilters, side };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    const newFilters = { ...localFilters, dateFrom: date };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    const newFilters = { ...localFilters, dateTo: date };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const cleared: BookingFilter = defaultFilters ?? {
      status: ['pending', 'processed'],
      side: 'all',
      dateFrom: undefined,
      dateTo: undefined,
    };
    setLocalFilters(cleared);
    onFiltersChange(cleared);
  };

  const selectedStatuses = new Set(localFilters.status ?? []);
  const defaultStatusSet =
    defaultFilters?.status && defaultFilters.status.length > 0
      ? new Set(defaultFilters.status)
      : new Set<BookingStatus>(['pending', 'processed']);
  const sameStatus =
    selectedStatuses.size === defaultStatusSet.size &&
    [...selectedStatuses].every((s) => defaultStatusSet.has(s));
  const sameSide =
    (localFilters.side ?? 'all') === (defaultFilters?.side ?? 'all');
  const sameDateFrom =
    localFilters.dateFrom?.getTime() === defaultFilters?.dateFrom?.getTime();
  const sameDateTo =
    localFilters.dateTo?.getTime() === defaultFilters?.dateTo?.getTime();
  const hasActiveFilters =
    !sameStatus || !sameSide || !sameDateFrom || !sameDateTo;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Filters</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status multi-select dropdown */}
        <div ref={statusDropdownRef} className="relative">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Status
          </label>
          <button
            type="button"
            onClick={() => setStatusDropdownOpen((open) => !open)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-left text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
          >
            <span className="truncate">
              {(localFilters.status?.length ?? 0) === 0
                ? 'Select statuses...'
                : STATUS_OPTIONS.filter((opt) =>
                    selectedStatuses.has(opt.value)
                  )
                    .map((opt) => opt.label)
                    .join(', ')}
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 shrink-0 ml-1 transition-transform ${
                statusDropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {statusDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-600 bg-slate-900 shadow-lg py-1 max-h-48 overflow-auto">
              {STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800 text-sm text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.has(opt.value)}
                    onChange={() => handleStatusToggle(opt.value)}
                    className="rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
          {(localFilters.status?.length ?? 0) === 0 && (
            <p className="text-xs text-slate-500 mt-1">
              Select at least one status to see bookings.
            </p>
          )}
        </div>

        {/* Side Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Side
          </label>
          <select
            value={localFilters.side || 'all'}
            onChange={(e) =>
              handleSideChange(e.target.value as 'Power' | 'Base' | 'all')
            }
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sides</option>
            <option value="Power">Power</option>
            <option value="Base">Base</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            From Date
          </label>
          <input
            type="date"
            value={
              localFilters.dateFrom
                ? format(localFilters.dateFrom, 'yyyy-MM-dd')
                : ''
            }
            onChange={handleDateFromChange}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            To Date
          </label>
          <input
            type="date"
            value={
              localFilters.dateTo
                ? format(localFilters.dateTo, 'yyyy-MM-dd')
                : ''
            }
            onChange={handleDateToChange}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
