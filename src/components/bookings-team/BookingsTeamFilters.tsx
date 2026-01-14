import type { BookingsTeamFilter } from '../../hooks/useBookingsTeam';
import type { BookingStatus } from '../../types/db';

type Props = {
  filters: BookingsTeamFilter;
  onFiltersChange: (filters: BookingsTeamFilter) => void;
  coaches?: Array<{ id: string; full_name: string | null }>;
};

export function BookingsTeamFilters({
  filters,
  onFiltersChange,
  coaches,
}: Props) {
  const statusOptions: Array<{ value: BookingStatus | 'all'; label: string }> =
    [
      { value: 'all', label: 'All Statuses' },
      { value: 'pending', label: 'Pending' },
      { value: 'pending_cancellation', label: 'Pending Cancellation' },
      { value: 'processed', label: 'Processed' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'draft', label: 'Draft' },
    ];

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Status
          </label>
          <select
            value={filters.status || 'all'}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                status:
                  e.target.value === 'all'
                    ? 'all'
                    : (e.target.value as BookingStatus),
              })
            }
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Side Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Side
          </label>
          <select
            value={filters.side || 'all'}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                side:
                  e.target.value === 'all'
                    ? 'all'
                    : (e.target.value as 'Power' | 'Base'),
              })
            }
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Sides</option>
            <option value="Power">Power</option>
            <option value="Base">Base</option>
          </select>
        </div>

        {/* Coach Filter */}
        {coaches && coaches.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Coach
            </label>
            <select
              value={filters.coachId || 'all'}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  coachId: e.target.value === 'all' ? 'all' : e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Coaches</option>
              {coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.full_name || coach.id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date From */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Date From
          </label>
          <input
            type="date"
            value={
              filters.dateFrom
                ? filters.dateFrom.toISOString().split('T')[0]
                : ''
            }
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                dateFrom: e.target.value ? new Date(e.target.value) : undefined,
              })
            }
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Date To
          </label>
          <input
            type="date"
            value={
              filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''
            }
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                dateTo: e.target.value ? new Date(e.target.value) : undefined,
              })
            }
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Clear Filters */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            onFiltersChange({
              status: 'all',
              side: 'all',
              coachId: 'all',
            })
          }
          className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
