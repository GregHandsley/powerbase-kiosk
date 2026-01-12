export type BookingStatus =
  | 'draft'
  | 'pending'
  | 'processed'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface BookingInstanceRow {
  id: number;
  booking_id: number;
  side_id: number;
  start: string; // ISO
  end: string; // column is "end" in DB
  areas: string[]; // JSONB array
  racks: number[]; // JSONB array
  created_at: string;
  updated_at: string;
}

export interface BookingInstanceWithBookingRow extends BookingInstanceRow {
  booking?: {
    title: string | null;
    color: string | null;
    is_locked: boolean;
    created_by: string | null;
    status?: BookingStatus;
    processed_by?: string | null;
    processed_at?: string | null;
    last_edited_at?: string | null;
    last_edited_by?: string | null;
  } | null;
}

export interface BookingRow {
  id: number;
  title: string;
  side_id: number;
  start_template: string;
  end_template: string;
  recurrence: unknown;
  areas: string[];
  racks: number[];
  color: string | null;
  created_by: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  status: BookingStatus;
  processed_by: string | null;
  processed_at: string | null;
  last_edited_at: string | null;
  last_edited_by: string | null;
}
