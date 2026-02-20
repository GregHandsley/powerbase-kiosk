export type SideRow = { id: number; name: string; key: string };

export type AtRiskBooking = {
  bookingId: number;
  title: string;
  side: string;
  nextStart: string;
  riskScore: number;
};

export type TodayBooking = {
  instanceId: number;
  bookingId: number;
  title: string;
  side: string;
  start: string;
  end: string;
  status: string | null;
  createdBy: string | null;
};

export type BusyPeriod = {
  time: string;
  utilizationPct: number;
  athletes: number;
  capacity: number;
  isGeneralUser: boolean;
};

export type SideUtilizationGraph = {
  sideId: number;
  sideName: string;
  sideKey: string;
  series: BusyPeriod[];
  avgUtilizationPct: number;
};

export type RackHeatCell = {
  rackNumber: number;
  occupancyPct: number;
  bookedSlots: number;
  bookableSlots: number;
};

export type SideRackHeatmap = {
  sideName: string;
  sideKey: string;
  cells: RackHeatCell[];
};

export type CurrentPeriod = {
  sideName: string;
  periodType: string;
};

export type DashboardInsights = {
  currentTimeMs: number;
  utilizationPct: number;
  sideUtilization: Array<{ side: string; value: number; peak: number }>;
  sideGraphs: SideUtilizationGraph[];
  rackHeatmaps: SideRackHeatmap[];
  currentPeriods: CurrentPeriod[];
  atRiskBookings: AtRiskBooking[];
  bookingsThisWeek: number;
  todaysBookings: TodayBooking[];
};

export type HoverTooltip = {
  x: number;
  y: number;
  lines: string[];
};
