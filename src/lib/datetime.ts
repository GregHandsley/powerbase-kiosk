// src/lib/datetime.ts

export function todayString(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`; // yyyy-mm-dd
  }
  
  export function currentTimeString(): string {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`; // HH:mm
  }
  
export function combineDateTime(dateStr: string, timeStr: string): Date {
  // date: yyyy-mm-dd, time: HH:mm
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  const d = new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0, 0);
  if (Number.isNaN(d.getTime())) {
    return new Date();
  }
  return d;
}
  