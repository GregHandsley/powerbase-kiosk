import { z } from 'zod';

export const BookingFormSchema = z.object({
  bookingType: z.enum(['catalogue', 'one_off']),
  squadFamilyId: z.number().int().positive().nullable().optional(),
  squadId: z.number().int().positive().nullable().optional(),
  oneOffName: z.string().optional(),
  title: z.string(),
  sideKey: z.enum(['Power', 'Base']),
  startDate: z.string().min(1, 'Start date is required'), // yyyy-mm-dd
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM')
    .refine((time) => {
      const [, minutes] = time.split(':').map(Number);
      return (
        minutes === 0 || minutes === 15 || minutes === 30 || minutes === 45
      );
    }, 'Start time must be on a 15-minute interval (00, 15, 30, or 45 minutes)'),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM')
    .refine((time) => {
      const [, minutes] = time.split(':').map(Number);
      return (
        minutes === 0 || minutes === 15 || minutes === 30 || minutes === 45
      );
    }, 'End time must be on a 15-minute interval (00, 15, 30, or 45 minutes)'),
  weeks: z
    .number()
    .refine((val) => !Number.isNaN(val), { message: 'Weeks is required' })
    .int({ message: 'Weeks must be a whole number' })
    .min(1, { message: 'At least 1 week' })
    .max(16, { message: 'Maximum 16 weeks for now' }),
  racksInput: z.string().min(1, 'At least one rack number is required'),
  areas: z.array(z.string()), // Required - default provided in form defaultValues
  color: z.string().optional(),
  isLocked: z.boolean().optional(), // will be ignored for non-admins
  emergencyReason: z.string().optional(),
  capacity: z
    .number()
    .int({ message: 'Number of athletes must be a whole number' })
    .min(1, { message: 'Number of athletes must be at least 1' })
    .max(100, { message: 'Number of athletes cannot exceed 100' }), // Required - default provided in form defaultValues
  areaSlots: z
    .array(
      z.object({
        area_key: z.string().min(1, 'Area is required'),
        start: z.string().min(1, 'Start time is required'),
        end: z.string().min(1, 'End time is required'),
      })
    )
    .default([]),
  /** Per-platform start/end within the booking window (create flow). Persisted as area_slots with area_key "rack_N". */
  platformSlots: z
    .array(
      z.object({
        rackNumber: z.number(),
        start: z.string(),
        end: z.string(),
      })
    )
    .optional()
    .default([]),
});

/** Time-first booking flow (Sprint 6): at least one of racksInput, areaSlots, or platformSlots required */
export const BookingFormSchemaTimeFirst = BookingFormSchema.extend({
  racksInput: z.string().optional(),
}).refine(
  (data) =>
    (data.racksInput?.trim()?.length ?? 0) > 0 ||
    (data.areaSlots?.length ?? 0) > 0 ||
    (data.platformSlots?.length ?? 0) > 0,
  {
    message: 'Add at least one area or platform to create a booking.',
    path: ['racksInput'],
  }
);

export type BookingFormValues = z.infer<typeof BookingFormSchema>;
export type BookingFormValuesTimeFirst = z.infer<
  typeof BookingFormSchemaTimeFirst
>;
