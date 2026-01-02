import { z } from "zod";

export const BookingFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  sideKey: z.enum(["Power", "Base"]),
  startDate: z.string().min(1, "Start date is required"), // yyyy-mm-dd
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Start time must be HH:MM")
    .refine((time) => {
      const [, minutes] = time.split(":").map(Number);
      return minutes === 0 || minutes === 30;
    }, "Start time must be on the hour or half hour (00 or 30 minutes)"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "End time must be HH:MM")
    .refine((time) => {
      const [, minutes] = time.split(":").map(Number);
      return minutes === 0 || minutes === 30;
    }, "End time must be on the hour or half hour (00 or 30 minutes)"),
  weeks: z
    .number()
    .refine((val) => !Number.isNaN(val), { message: "Weeks is required" })
    .int({ message: "Weeks must be a whole number" })
    .min(1, { message: "At least 1 week" })
    .max(16, { message: "Maximum 16 weeks for now" }),
  racksInput: z
    .string()
    .min(1, "At least one rack number is required"),
  areas: z.array(z.string()).default([]),
  color: z.string().optional(),
  isLocked: z.boolean().optional(), // will be ignored for non-admins
  capacity: z
    .number()
    .int({ message: "Number of athletes must be a whole number" })
    .min(1, { message: "Number of athletes must be at least 1" })
    .max(100, { message: "Number of athletes cannot exceed 100" })
    .default(1),
});

export type BookingFormValues = z.infer<typeof BookingFormSchema>;
