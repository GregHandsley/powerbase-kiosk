export interface BookingInstanceRow {
    id: number;
    booking_id: number;
    side_id: number;
    start: string; // ISO string
    end: string;   // column is "end" in DB, appears as end in JS
    areas: string[];   // JSONB array
    racks: number[];   // JSONB array
    created_at: string;
    updated_at: string;
  }
  