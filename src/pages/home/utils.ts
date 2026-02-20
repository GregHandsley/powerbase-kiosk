import type { ScheduleData } from '../../components/admin/capacity/scheduleUtils';
import {
  addColumnSpacer,
  addDoubleColumnSpacers,
  addRowSpacer,
  makeBaseLayout,
  makePowerLayout,
} from '../../components/schedule/shared/layouts';
import {
  BASE_GRID_CONFIG,
  POWER_GRID_CONFIG,
} from '../../components/schedule/shared/gridConfig';
import type { RackRow } from '../../components/schedule/RackListEditorCore';
import type { BusyPeriod } from './types';
import { doesScheduleApply } from '../../components/admin/capacity/scheduleUtils';

function recurrencePriority(recurrenceType: string): number {
  switch (recurrenceType) {
    case 'single':
      return 5;
    case 'weekly':
      return 4;
    case 'weekday':
    case 'weekend':
      return 3;
    case 'all_future':
      return 2;
    default:
      return 1;
  }
}

export function getApplicableScheduleForSlot(
  schedules: ScheduleData[],
  dayOfWeek: number,
  dateStr: string,
  timeStr: string
): ScheduleData | null {
  const matches = schedules.filter((schedule) =>
    doesScheduleApply(schedule, dayOfWeek, dateStr, timeStr)
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  matches.sort((a, b) => {
    if (a.period_type === 'Closed' && b.period_type !== 'Closed') return 1;
    if (a.period_type !== 'Closed' && b.period_type === 'Closed') return -1;

    const recurrenceDiff =
      recurrencePriority(b.recurrence_type) -
      recurrencePriority(a.recurrence_type);
    if (recurrenceDiff !== 0) return recurrenceDiff;

    const dateDiff = b.start_date.localeCompare(a.start_date);
    if (dateDiff !== 0) return dateDiff;

    const timeDiff = b.start_time.localeCompare(a.start_time);
    if (timeDiff !== 0) return timeDiff;

    return b.id - a.id;
  });

  return matches[0];
}

export function compactSeries(series: BusyPeriod[]): BusyPeriod[] {
  if (series.length <= 24) return series;
  const bucketSize = Math.ceil(series.length / 24);
  const compacted: BusyPeriod[] = [];
  for (let i = 0; i < series.length; i += bucketSize) {
    const bucket = series.slice(i, i + bucketSize);
    const avgUtilization =
      bucket.length > 0
        ? Math.round(
            bucket.reduce((sum, point) => sum + point.utilizationPct, 0) /
              bucket.length
          )
        : 0;
    const avgAthletes =
      bucket.length > 0
        ? Math.round(
            bucket.reduce((sum, point) => sum + point.athletes, 0) /
              bucket.length
          )
        : 0;
    const avgCapacity =
      bucket.length > 0
        ? Math.round(
            bucket.reduce((sum, point) => sum + point.capacity, 0) /
              bucket.length
          )
        : 0;
    compacted.push({
      time: bucket[0]?.time ?? '',
      utilizationPct: avgUtilization,
      athletes: avgAthletes,
      capacity: avgCapacity,
      isGeneralUser:
        bucket.length > 0 && bucket.every((point) => point.isGeneralUser),
    });
  }
  return compacted;
}

export function getRackHeatColor(occupancyPct: number): string {
  const ratio = Math.max(0, Math.min(1, occupancyPct / 100));
  const hue = 130 - ratio * 130;
  return `hsl(${hue} 75% 42%)`;
}

export function getSideRackNumbers(sideKey: string): number[] {
  const layout = sideKey === 'base' ? makeBaseLayout() : makePowerLayout();
  return [
    ...new Set(
      layout
        .map((row) => row.rackNumber)
        .filter((rack): rack is number => rack !== null)
    ),
  ].sort((a, b) => a - b);
}

export function getHeatLayout(sideKey: string): {
  rows: RackRow[];
  gridTemplateColumns: string;
  numRows: number;
  showBanner: boolean;
  bannerRowSpan: string;
} {
  if (sideKey === 'base') {
    return {
      rows: addRowSpacer(addColumnSpacer(makeBaseLayout()), 3),
      gridTemplateColumns: BASE_GRID_CONFIG.gridTemplateColumns,
      numRows: BASE_GRID_CONFIG.numRows,
      showBanner: BASE_GRID_CONFIG.showBanner,
      bannerRowSpan: BASE_GRID_CONFIG.bannerRowSpan,
    };
  }
  return {
    rows: addRowSpacer(addDoubleColumnSpacers(makePowerLayout()), 2),
    gridTemplateColumns: POWER_GRID_CONFIG.gridTemplateColumns,
    numRows: POWER_GRID_CONFIG.numRows,
    showBanner: POWER_GRID_CONFIG.showBanner,
    bannerRowSpan: POWER_GRID_CONFIG.bannerRowSpan,
  };
}
