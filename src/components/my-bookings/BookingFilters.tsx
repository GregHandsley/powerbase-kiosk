import { useState } from 'react';
import type { BookingFilter } from '../../hooks/useMyBookings';
import type { BookingStatus } from '../../types/db';
import { format } from 'date-fns';

type Props = {
  filters: BookingFilter;
  onFiltersChange: (filters: BookingFilter) => void;
};

export function BookingFilters({ filters, onFiltersChange }: Props) {
  const [localFilters, setLocalFilters] = useState<BookingFilter>(filters);

  const handleStatusChange = (status: BookingStatus | 'all') => {
    const newFilters = { ...localFilters, status };
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
    const cleared = {
      status: 'all' as const,
      side: 'all' as const,
      dateFrom: undefined,
      dateTo: undefined,
    };
    setLocalFilters(cleared);
    onFiltersChange(cleared);
  };

  const hasActiveFilters =
    localFilters.status !== 'all' ||
    localFilters.side !== 'all' ||
    localFilters.dateFrom !== undefined ||
    localFilters.dateTo !== undefined;

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
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Status
          </label>
          <select
            value={localFilters.status || 'all'}
            onChange={(e) =>
              handleStatusChange(e.target.value as BookingStatus | 'all')
            }
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="processed">Processed</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
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
