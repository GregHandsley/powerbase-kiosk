import { useQuery } from '@tanstack/react-query';
import { formatDateTime } from '../../shared/dateUtils';
import { supabase } from '../../../lib/supabaseClient';

interface BookingInfo {
  id: number;
  title: string;
  color: string | null;
  is_locked: boolean;
}

interface BookingInstance {
  id: number;
  start: string;
  end: string;
  booking_id: number;
}

interface PeriodTypeOverride {
  id: number;
  booking_id: number | null;
}

type Props = {
  override: PeriodTypeOverride;
  isExpanded: boolean;
  selectedForBooking: Set<number>;
  onToggleExpanded: () => void;
  onToggleInstanceSelection: (instanceId: number) => void;
  onDeleteSelected: () => void;
  onDeleteSeries: () => void;
  loading: boolean;
};

/**
 * Component to display booking information for an override
 */
export function BookingInfoDisplay({
  override,
  isExpanded,
  selectedForBooking,
  onToggleExpanded,
  onToggleInstanceSelection,
  onDeleteSelected,
  onDeleteSeries,
  loading,
}: Props) {
  const { data: bookingInfo, isLoading: loadingBooking } =
    useQuery<BookingInfo | null>({
      queryKey: ['booking-info', override.booking_id],
      queryFn: async () => {
        if (!override.booking_id) return null;
        const { data, error } = await supabase
          .from('bookings')
          .select('id, title, color, is_locked')
          .eq('id', override.booking_id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching booking info:', error);
          return null;
        }
        return data as BookingInfo | null;
      },
      enabled: !!override.booking_id,
    });

  const { data: instances = [], isLoading: loadingInstances } = useQuery<
    BookingInstance[]
  >({
    queryKey: ['booking-instances', override.booking_id],
    queryFn: async () => {
      if (!override.booking_id) return [];
      const { data, error } = await supabase
        .from('booking_instances')
        .select('id, start, end, booking_id')
        .eq('booking_id', override.booking_id)
        .order('start', { ascending: true });

      if (error) {
        console.error('Error fetching booking instances:', error);
        return [];
      }
      return (data ?? []) as BookingInstance[];
    },
    enabled: !!override.booking_id,
  });

  if (!override.booking_id) return null;

  return (
    <div className="mt-2 space-y-2">
      {loadingBooking || loadingInstances ? (
        <div className="text-xs text-slate-400">Loading booking info...</div>
      ) : bookingInfo ? (
        <>
          <div className="flex items-center justify-between p-2 rounded border border-slate-600 bg-slate-900/50">
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-200">
                Booking: {bookingInfo.title}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {instances.length} instance{instances.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={onToggleExpanded}
              className="px-2 py-1 text-[10px] font-medium rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              {isExpanded ? 'Hide' : 'Show'} Instances
            </button>
          </div>

          {isExpanded && instances.length > 0 && (
            <div className="ml-4 space-y-1">
              <div className="text-[10px] text-slate-400 mb-1">
                Select instances to delete, or delete the entire series:
              </div>
              {instances.map((instance) => {
                const isSelected = selectedForBooking.has(instance.id);
                return (
                  <div
                    key={instance.id}
                    className="flex items-center justify-between p-2 rounded border border-slate-700 bg-slate-950/50"
                  >
                    <label className="flex items-center gap-2 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleInstanceSelection(instance.id)}
                        className="w-3 h-3 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-300">
                        {formatDateTime(instance.start)} -{' '}
                        {formatDateTime(instance.end)}
                      </span>
                    </label>
                  </div>
                );
              })}

              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700">
                <button
                  onClick={onDeleteSelected}
                  disabled={loading || selectedForBooking.size === 0}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-orange-900/20 border border-orange-700 text-orange-400 hover:bg-orange-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete Selected ({selectedForBooking.size})
                </button>
                <button
                  onClick={onDeleteSeries}
                  disabled={loading}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-red-900/20 border border-red-700 text-red-400 hover:bg-red-900/30 disabled:opacity-50"
                >
                  Delete Entire Series
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
