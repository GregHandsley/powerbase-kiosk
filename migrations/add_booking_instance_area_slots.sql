-- Area slots: time-bound area usage per booking instance (Sprint 2).
-- Each row = one area used from start to end within an instance's window.
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.booking_instance_area_slots (
  id bigserial PRIMARY KEY,
  booking_instance_id bigint NOT NULL REFERENCES public.booking_instances(id) ON DELETE CASCADE,
  area_key text NOT NULL,
  start timestamptz NOT NULL,
  "end" timestamptz NOT NULL,
  CONSTRAINT booking_instance_area_slots_start_end_check CHECK (start < "end")
);

CREATE INDEX IF NOT EXISTS booking_instance_area_slots_instance_id_idx
  ON public.booking_instance_area_slots (booking_instance_id);

CREATE INDEX IF NOT EXISTS booking_instance_area_slots_area_time_idx
  ON public.booking_instance_area_slots (area_key, start, "end");

COMMENT ON TABLE public.booking_instance_area_slots IS
  'Time-bound area usage per instance. Used for wayfinding "in use" at time T. Slot start/end must be within the instance start/end (enforced in app).';
