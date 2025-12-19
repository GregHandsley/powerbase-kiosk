import type { PeriodType } from "./scheduleUtils";

export const PERIOD_TYPE_COLORS: Record<PeriodType, { bg: string; text: string; border: string }> = {
  "High Hybrid": {
    bg: "bg-blue-900/40",
    text: "text-blue-200",
    border: "border-blue-600",
  },
  "Low Hybrid": {
    bg: "bg-cyan-900/40",
    text: "text-cyan-200",
    border: "border-cyan-600",
  },
  "Performance": {
    bg: "bg-purple-900/40",
    text: "text-purple-200",
    border: "border-purple-600",
  },
  "General User": {
    bg: "bg-green-900/40",
    text: "text-green-200",
    border: "border-green-600",
  },
  "Closed": {
    bg: "bg-red-900/40",
    text: "text-red-200",
    border: "border-red-600",
  },
};

