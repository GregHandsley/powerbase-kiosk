export interface BookingInstanceRow {
    id: number;
    booking_id: number;
    side_id: number;
    start: string; // ISO
    end: string;   // column is "end" in DB
    areas: string[];   // JSONB array
    racks: number[];   // JSONB array
    created_at: string;
    updated_at: string;
  }
  
  export interface BookingInstanceWithBookingRow extends BookingInstanceRow {
    booking?: {
      title: string | null;
      color: string | null;
      is_locked: boolean;
      created_by: string | null;
    } | null;
  }
  