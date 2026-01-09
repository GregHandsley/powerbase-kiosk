import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { BookingRow, BookingStatus } from "../types/db";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";

export type BookingFilter = {
  status?: BookingStatus | "all";
  side?: "Power" | "Base" | "all";
  dateFrom?: Date;
  dateTo?: Date;
};

export type BookingWithInstances = BookingRow & {
  instances: Array<{
    id: number;
    start: string;
    end: string;
    racks: number[];
    areas: string[];
    capacity?: number;
  }>;
  side: {
    key: string;
    name: string;
  };
};

export function useMyBookings(userId: string | null, filters: BookingFilter = {}) {
  return useQuery<BookingWithInstances[]>({
    queryKey: ["my-bookings", userId, filters],
    queryFn: async () => {
      if (!userId) return [];

      // Build query - try with status field first, fallback if migration not run
      let query = supabase
        .from("bookings")
        .select(
          `
          *,
          side:sides (
            key,
            name
          )
        `
        )
        .eq("created_by", userId)
        .order("created_at", { ascending: false });

      // Apply status filter (only if status column exists)
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      let { data: bookings, error } = await query;

      // If error is about missing status column, retry without status filter
      if (error && (error.message?.includes("does not exist") || error.message?.includes("column"))) {
        if (filters.status && filters.status !== "all") {
          // Can't filter by status if column doesn't exist, so ignore status filter
          query = supabase
            .from("bookings")
            .select(
              `
              *,
              side:sides (
                key,
                name
              )
            `
            )
            .eq("created_by", userId)
            .order("created_at", { ascending: false });
          
          const retryResult = await query;
          bookings = retryResult.data;
          error = retryResult.error;
        }
      }

      // Apply side filter
      if (filters.side && filters.side !== "all") {
        // We need to join with sides table
        const { data: sides } = await supabase
          .from("sides")
          .select("id")
          .eq("key", filters.side)
          .maybeSingle();

        if (sides) {
          query = query.eq("side_id", sides.id);
        }
      }


      if (error) {
        console.error("Error fetching user bookings:", error);
        throw error;
      }

      if (!bookings || bookings.length === 0) {
        return [];
      }

      // Filter by status in memory if status column doesn't exist in DB
      let filteredBookings = bookings as BookingRow[];
      if (filters.status && filters.status !== "all") {
        // Check if status field exists in the data
        const hasStatusField = filteredBookings.some((b) => "status" in b);
        if (hasStatusField) {
          filteredBookings = filteredBookings.filter((b) => b.status === filters.status);
        }
        // If status field doesn't exist, we can't filter - show all
      }

      // Fetch instances for each booking
      const bookingsWithInstances: BookingWithInstances[] = await Promise.all(
        filteredBookings.map(async (booking) => {
          // Apply date filters to instances
          let instancesQuery = supabase
            .from("booking_instances")
            .select("id, start, end, racks, areas, capacity")
            .eq("booking_id", booking.id)
            .order("start", { ascending: true });

          if (filters.dateFrom) {
            instancesQuery = instancesQuery.gte("start", filters.dateFrom.toISOString());
          }
          if (filters.dateTo) {
            instancesQuery = instancesQuery.lte("start", endOfDay(filters.dateTo).toISOString());
          }

          const { data: instances } = await instancesQuery;

          return {
            ...booking,
            instances: instances || [],
            side: (booking as any).side || { key: "", name: "" },
          };
        })
      );

      // Filter out bookings with no instances (if date filter was applied)
      return bookingsWithInstances.filter((b) => b.instances.length > 0);
    },
    enabled: !!userId,
  });
}

