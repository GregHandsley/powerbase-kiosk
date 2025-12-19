-- Migration: Add capacity (number of people) to bookings and booking_instances
-- This allows tracking how many people will be in each session

-- Add capacity_template to bookings table (default capacity for all instances)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS capacity_template integer DEFAULT 1;

-- Add capacity to booking_instances table (can vary per week/instance)
ALTER TABLE public.booking_instances
ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 1;

-- Add constraints to ensure capacity is positive
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_capacity_template_check CHECK (capacity_template > 0);

ALTER TABLE public.booking_instances
ADD CONSTRAINT booking_instances_capacity_check CHECK (capacity > 0);

-- Add comments for documentation
COMMENT ON COLUMN public.bookings.capacity_template IS 'Default number of people for all instances in this booking series';
COMMENT ON COLUMN public.booking_instances.capacity IS 'Number of people for this specific booking instance';

