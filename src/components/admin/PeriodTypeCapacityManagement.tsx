import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { formatDateTime } from "../shared/dateUtils";

type PeriodType = "High Hybrid" | "Low Hybrid" | "Performance" | "General User" | "Closed";

interface PeriodTypeDefault {
  id: number;
  period_type: PeriodType;
  default_capacity: number;
}

interface PeriodTypeOverride {
  id: number;
  date: string;
  period_type: PeriodType;
  capacity: number;
  booking_id: number | null;
  notes: string | null;
}

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

export function PeriodTypeCapacityManagement() {
  const queryClient = useQueryClient();
  const [defaults, setDefaults] = useState<Map<PeriodType, PeriodTypeDefault>>(new Map());
  const [overrides, setOverrides] = useState<PeriodTypeOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDefault, setEditingDefault] = useState<PeriodType | null>(null);
  const [editingOverride, setEditingOverride] = useState<PeriodTypeOverride | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideDate, setOverrideDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [overridePeriodType, setOverridePeriodType] = useState<PeriodType>("High Hybrid");
  const [overrideCapacity, setOverrideCapacity] = useState(0);
  const [overrideNotes, setOverrideNotes] = useState("");
  const [expandedOverrides, setExpandedOverrides] = useState<Set<number>>(new Set());
  const [deletingBooking, setDeletingBooking] = useState<{
    bookingId: number;
    instanceIds: number[];
    type: "selected" | "series";
  } | null>(null);
  const [selectedInstances, setSelectedInstances] = useState<Map<number, Set<number>>>(new Map());

  const periodTypes: PeriodType[] = ["High Hybrid", "Low Hybrid", "Performance", "General User", "Closed"];

  // Component to display booking info for an override
  const BookingInfoDisplay = ({ 
    override,
    isExpanded,
    selectedForBooking,
    onToggleExpanded,
    onToggleInstanceSelection,
    onDeleteSelected,
    onDeleteSeries,
    loading,
  }: { 
    override: PeriodTypeOverride;
    isExpanded: boolean;
    selectedForBooking: Set<number>;
    onToggleExpanded: () => void;
    onToggleInstanceSelection: (instanceId: number) => void;
    onDeleteSelected: () => void;
    onDeleteSeries: () => void;
    loading: boolean;
  }) => {
    const { data: bookingInfo, isLoading: loadingBooking } = useBookingInfo(override.booking_id);
    const { data: instances = [], isLoading: loadingInstances } = useBookingInstances(override.booking_id);

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
                  {instances.length} instance{instances.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={onToggleExpanded}
                className="px-2 py-1 text-[10px] font-medium rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                {isExpanded ? "Hide" : "Show"} Instances
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
                          {formatDateTime(instance.start)} - {formatDateTime(instance.end)}
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
  };

  // Fetch defaults
  useEffect(() => {
    async function fetchDefaults() {
      const { data, error } = await supabase
        .from("period_type_capacity_defaults")
        .select("*")
        .order("period_type");

      if (error) {
        console.error("Error fetching defaults:", error);
        return;
      }

      const defaultsMap = new Map<PeriodType, PeriodTypeDefault>();
      data?.forEach((default_) => {
        defaultsMap.set(default_.period_type as PeriodType, default_ as PeriodTypeDefault);
      });

      setDefaults(defaultsMap);
    }

    fetchDefaults();
  }, []);

  // Fetch overrides (last 30 days and future)
  useEffect(() => {
    async function fetchOverrides() {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("period_type_capacity_overrides")
        .select("*")
        .gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching overrides:", error);
        return;
      }

      setOverrides((data as PeriodTypeOverride[]) || []);
    }

    fetchOverrides();
  }, []);

  const handleSaveDefault = async (periodType: PeriodType, capacity: number) => {
    setLoading(true);
    try {
      const existing = defaults.get(periodType);

      if (existing && existing.id) {
        // Update existing - use period_type as the unique identifier since we have UNIQUE constraint
        const { error } = await supabase
          .from("period_type_capacity_defaults")
          .update({ default_capacity: capacity })
          .eq("period_type", periodType);

        if (error) throw error;
      } else {
        // Insert new (or upsert if it somehow exists without an id)
        // Use upsert to handle the case where a record exists but wasn't loaded
        const { error } = await supabase
          .from("period_type_capacity_defaults")
          .upsert(
            {
              period_type: periodType,
              default_capacity: capacity,
            },
            {
              onConflict: "period_type",
            }
          );

        if (error) throw error;
      }

      // Refresh defaults
      const { data } = await supabase
        .from("period_type_capacity_defaults")
        .select("*")
        .order("period_type");

      const defaultsMap = new Map<PeriodType, PeriodTypeDefault>();
      data?.forEach((default_) => {
        defaultsMap.set(default_.period_type as PeriodType, default_ as PeriodTypeDefault);
      });
      setDefaults(defaultsMap);
      setEditingDefault(null);
    } catch (error) {
      console.error("Error saving default:", error);
      alert("Failed to save default capacity");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOverride = async () => {
    setLoading(true);
    try {
      if (editingOverride) {
        // Update existing override
        const { error } = await supabase
          .from("period_type_capacity_overrides")
          .update({
            capacity: overrideCapacity,
            notes: overrideNotes || null,
          })
          .eq("id", editingOverride.id);

        if (error) throw error;
      } else {
        // Insert new override
        const { error } = await supabase.from("period_type_capacity_overrides").insert({
          date: overrideDate,
          period_type: overridePeriodType,
          capacity: overrideCapacity,
          notes: overrideNotes || null,
        });

        if (error) throw error;
      }

      // Refresh overrides
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data } = await supabase
        .from("period_type_capacity_overrides")
        .select("*")
        .gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      setOverrides((data as PeriodTypeOverride[]) || []);
      setShowOverrideModal(false);
      setEditingOverride(null);
      setOverrideDate(format(new Date(), "yyyy-MM-dd"));
      setOverridePeriodType("High Hybrid");
      setOverrideCapacity(0);
      setOverrideNotes("");
    } catch (error) {
      console.error("Error saving override:", error);
      alert("Failed to save override");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOverride = async (id: number) => {
    if (!confirm("Are you sure you want to delete this override?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("period_type_capacity_overrides")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setOverrides(overrides.filter((o) => o.id !== id));
    } catch (error) {
      console.error("Error deleting override:", error);
      alert("Failed to delete override");
    } finally {
      setLoading(false);
    }
  };

  const openEditOverride = (override: PeriodTypeOverride) => {
    setEditingOverride(override);
    setOverrideDate(override.date);
    setOverridePeriodType(override.period_type);
    setOverrideCapacity(override.capacity);
    setOverrideNotes(override.notes || "");
    setShowOverrideModal(true);
  };

  const toggleOverrideExpanded = (overrideId: number) => {
    const newExpanded = new Set(expandedOverrides);
    if (newExpanded.has(overrideId)) {
      newExpanded.delete(overrideId);
    } else {
      newExpanded.add(overrideId);
    }
    setExpandedOverrides(newExpanded);
  };

  // Fetch booking info for a booking_id
  const useBookingInfo = (bookingId: number | null) => {
    return useQuery<BookingInfo | null>({
      queryKey: ["booking-info", bookingId],
      queryFn: async () => {
        if (!bookingId) return null;
        const { data, error } = await supabase
          .from("bookings")
          .select("id, title, color, is_locked")
          .eq("id", bookingId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching booking info:", error);
          return null;
        }
        return data as BookingInfo | null;
      },
      enabled: !!bookingId,
    });
  };

  // Fetch booking instances for a booking_id
  const useBookingInstances = (bookingId: number | null) => {
    return useQuery<BookingInstance[]>({
      queryKey: ["booking-instances", bookingId],
      queryFn: async () => {
        if (!bookingId) return [];
        const { data, error } = await supabase
          .from("booking_instances")
          .select("id, start, end, booking_id")
          .eq("booking_id", bookingId)
          .order("start", { ascending: true });

        if (error) {
          console.error("Error fetching booking instances:", error);
          return [];
        }
        return (data ?? []) as BookingInstance[];
      },
      enabled: !!bookingId,
    });
  };

  const handleDeleteSelectedInstances = async (bookingId: number, instanceIds: number[]) => {
    if (instanceIds.length === 0) return false;

    setLoading(true);
    try {
      // Delete the selected instances
      const { error: deleteError } = await supabase
        .from("booking_instances")
        .delete()
        .in("id", instanceIds);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Check if there are any remaining instances
      const { data: remainingInstances, error: checkError } = await supabase
        .from("booking_instances")
        .select("id")
        .eq("booking_id", bookingId)
        .limit(1);

      if (checkError) {
        console.warn("Error checking remaining instances:", checkError);
      }

      // If no instances remain, delete the booking
      if (!remainingInstances || remainingInstances.length === 0) {
        const { error: bookingError } = await supabase
          .from("bookings")
          .delete()
          .eq("id", bookingId);

        if (bookingError) {
          console.warn("Failed to delete booking after deleting all instances:", bookingError);
        }
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ["booking-info", bookingId] });
      await queryClient.invalidateQueries({ queryKey: ["booking-instances", bookingId] });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-series"], exact: false });

      // Refresh overrides to update the UI
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from("period_type_capacity_overrides")
        .select("*")
        .gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false });
      setOverrides((data as PeriodTypeOverride[]) || []);

      return true;
    } catch (error) {
      console.error("Failed to delete instances", error);
      alert(`Failed to delete bookings: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    } finally {
      setLoading(false);
      setDeletingBooking(null);
      // Clear selected instances for this booking
      const newSelected = new Map(selectedInstances);
      newSelected.delete(bookingId);
      setSelectedInstances(newSelected);
    }
  };

  const handleDeleteSeries = async (bookingId: number) => {
    setLoading(true);
    try {
      // Delete all instances
      const { error: instancesError } = await supabase
        .from("booking_instances")
        .delete()
        .eq("booking_id", bookingId);

      if (instancesError) {
        throw new Error(instancesError.message);
      }

      // Delete the booking
      const { error: bookingError } = await supabase
        .from("bookings")
        .delete()
        .eq("id", bookingId);

      if (bookingError) {
        throw new Error(bookingError.message);
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ["booking-info", bookingId] });
      await queryClient.invalidateQueries({ queryKey: ["booking-instances", bookingId] });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-series"], exact: false });

      // Refresh overrides to update the UI
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from("period_type_capacity_overrides")
        .select("*")
        .gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false });
      setOverrides((data as PeriodTypeOverride[]) || []);

      return true;
    } catch (error) {
      console.error("Failed to delete series", error);
      alert(`Failed to delete booking series: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    } finally {
      setLoading(false);
      setDeletingBooking(null);
      // Clear selected instances for this booking
      const newSelected = new Map(selectedInstances);
      newSelected.delete(bookingId);
      setSelectedInstances(newSelected);
    }
  };

  const toggleInstanceSelection = (bookingId: number, instanceId: number) => {
    const newSelected = new Map(selectedInstances);
    const bookingSelected = newSelected.get(bookingId) || new Set<number>();
    
    if (bookingSelected.has(instanceId)) {
      bookingSelected.delete(instanceId);
    } else {
      bookingSelected.add(instanceId);
    }
    
    if (bookingSelected.size === 0) {
      newSelected.delete(bookingId);
    } else {
      newSelected.set(bookingId, bookingSelected);
    }
    
    setSelectedInstances(newSelected);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Period Type Capacity</h2>
          <p className="text-sm text-slate-400 mt-1">
            Set default capacity for each period type (shared across all sides) and override for specific dates
          </p>
        </div>
      </div>

      {/* Defaults Section */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Default Capacity by Period Type</h3>
        <div className="space-y-3">
          {periodTypes.map((periodType) => {
            const default_ = defaults.get(periodType);
            const isEditing = editingDefault === periodType;

            return (
              <div
                key={periodType}
                className="flex items-center justify-between p-3 rounded-md border border-slate-700 bg-slate-950/50"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">{periodType}</div>
                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min={0}
                        value={default_?.default_capacity || 0}
                        onChange={(e) => {
                          const newDefault = {
                            ...default_,
                            period_type: periodType,
                            default_capacity: parseInt(e.target.value) || 0,
                          } as PeriodTypeDefault;
                          setDefaults(new Map(defaults).set(periodType, newDefault));
                        }}
                        className="w-24 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleSaveDefault(periodType, default_?.default_capacity || 0)}
                        disabled={loading}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={async () => {
                          setEditingDefault(null);
                          // Reset to original value
                          const { data } = await supabase
                            .from("period_type_capacity_defaults")
                            .select("*")
                            .order("period_type");
                          
                          const defaultsMap = new Map<PeriodType, PeriodTypeDefault>();
                          data?.forEach((default_) => {
                            defaultsMap.set(default_.period_type as PeriodType, default_ as PeriodTypeDefault);
                          });
                          setDefaults(defaultsMap);
                        }}
                        className="px-3 py-1 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 mt-1">
                      Default: {default_?.default_capacity ?? "Not set"}
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setEditingDefault(periodType)}
                    className="px-3 py-1 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    {default_ ? "Edit" : "Set"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Overrides Section */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">Date-Specific Overrides</h3>
          <button
            onClick={() => {
              setEditingOverride(null);
              setOverrideDate(format(new Date(), "yyyy-MM-dd"));
              setOverridePeriodType("High Hybrid");
              setOverrideCapacity(0);
              setOverrideNotes("");
              setShowOverrideModal(true);
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            + Add Override
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {overrides.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">
              No overrides set. Click "Add Override" to set capacity for a specific date.
            </div>
          ) : (
            <div className="space-y-2">
              {overrides.map((override) => (
                <div
                  key={override.id}
                  className="p-3 rounded-md border border-slate-700 bg-slate-950/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-200">
                        {format(new Date(override.date), "EEE, MMM d, yyyy")} - {override.period_type}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Capacity: {override.capacity}
                        {override.notes && ` • ${override.notes}`}
                      </div>
                      {override.booking_id && (
                        <BookingInfoDisplay
                          override={override}
                          isExpanded={expandedOverrides.has(override.id)}
                          selectedForBooking={selectedInstances.get(override.booking_id) || new Set<number>()}
                          onToggleExpanded={() => toggleOverrideExpanded(override.id)}
                          onToggleInstanceSelection={(instanceId) => toggleInstanceSelection(override.booking_id!, instanceId)}
                          onDeleteSelected={() => {
                            const instanceIds = Array.from(selectedInstances.get(override.booking_id!) || new Set());
                            if (instanceIds.length === 0) {
                              alert("Please select at least one instance to delete");
                              return;
                            }
                            setDeletingBooking({
                              bookingId: override.booking_id!,
                              instanceIds,
                              type: "selected",
                            });
                          }}
                          onDeleteSeries={() => {
                            setDeletingBooking({
                              bookingId: override.booking_id!,
                              instanceIds: [],
                              type: "series",
                            });
                          }}
                          loading={loading}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditOverride(override)}
                        className="px-3 py-1 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteOverride(override.id)}
                        disabled={loading}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-red-900/20 border border-red-700 text-red-400 hover:bg-red-900/30 disabled:opacity-50"
                      >
                        Delete Override
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowOverrideModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingOverride ? "Edit Override" : "Add Override"}
              </h3>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                <input
                  type="date"
                  value={overrideDate}
                  onChange={(e) => setOverrideDate(e.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Period Type</label>
                <select
                  value={overridePeriodType}
                  onChange={(e) => setOverridePeriodType(e.target.value as PeriodType)}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {periodTypes.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Capacity</label>
                <input
                  type="number"
                  min={0}
                  value={overrideCapacity}
                  onChange={(e) => setOverrideCapacity(parseInt(e.target.value) || 0)}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes (optional)</label>
                <textarea
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g., Reduced capacity due to event"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverride}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Booking Confirmation Dialog */}
      {deletingBooking && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeletingBooking(null);
            }
          }}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-100 mb-2">
              {deletingBooking.type === "selected"
                ? `Delete ${deletingBooking.instanceIds.length} Selected Session${deletingBooking.instanceIds.length !== 1 ? "s" : ""}?`
                : "Delete Entire Series?"}
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              {deletingBooking.type === "selected"
                ? `This will delete ${deletingBooking.instanceIds.length} selected session${deletingBooking.instanceIds.length !== 1 ? "s" : ""}. Other sessions in the series will remain. This action cannot be undone.`
                : "This will delete all sessions in this series. This action cannot be undone."}
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setDeletingBooking(null)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (deletingBooking.type === "selected") {
                    await handleDeleteSelectedInstances(
                      deletingBooking.bookingId,
                      deletingBooking.instanceIds
                    );
                  } else {
                    await handleDeleteSeries(deletingBooking.bookingId);
                  }
                }}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

