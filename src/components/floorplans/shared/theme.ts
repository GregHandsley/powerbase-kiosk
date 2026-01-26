export type RackAppearance = 'default' | 'kiosk' | 'status-board';

export const rackPaddingByAppearance: Record<RackAppearance, number> = {
  default: 0.8,
  kiosk: 0.6,
  'status-board': 0.7,
};

export const rackCornerRadiusByAppearance: Record<RackAppearance, number> = {
  default: 3.2,
  kiosk: 0,
  'status-board': 0,
};

export const rackStrokeWidthByAppearance: Record<RackAppearance, number> = {
  default: 0.35,
  kiosk: 0,
  'status-board': 0,
};

export const rackFontFamilyByAppearance: Record<RackAppearance, string> = {
  default: '"SF Pro Display", "Inter", system-ui, sans-serif',
  kiosk: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  'status-board':
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export const rackMonoFamilyByAppearance: Record<RackAppearance, string> = {
  default: '"Inter", "SFMono-Regular", ui-monospace, monospace',
  kiosk: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  'status-board':
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

type RackPaletteEntry = {
  fillTop: string;
  fillBottom: string;
  fill: string;
  stroke: string;
  label: string;
  primary: string;
  primaryStrong: string;
  muted: string;
  secondary: string;
  accent: string;
};

type RackPalette = {
  occupied: RackPaletteEntry;
  free: RackPaletteEntry;
};

export const rackPaletteByAppearance: Record<RackAppearance, RackPalette> = {
  default: {
    occupied: {
      fillTop: '#2b5cff',
      fillBottom: '#1e3a8a',
      fill: '#1e3a8a',
      stroke: 'rgba(255,255,255,0.12)',
      label: '#e2e8f0',
      primary: '#f8fafc',
      primaryStrong: '#f8fafc',
      muted: '#cbd5e1',
      secondary: '#dce3ed',
      accent: '#93c5fd',
    },
    free: {
      fillTop: '#111827',
      fillBottom: '#0b1224',
      fill: '#0b1224',
      stroke: 'rgba(255,255,255,0.06)',
      label: '#e2e8f0',
      primary: '#e2e8f0',
      primaryStrong: '#60a5fa', // highlight for "Available"
      muted: '#94a3b8',
      secondary: '#cbd5e1',
      accent: '#a5b4fc',
    },
  },
  kiosk: {
    occupied: {
      fill: '#1e40af',
      fillTop: '#1e40af',
      fillBottom: '#1e40af',
      stroke: 'none',
      label: '#dbeafe',
      primary: '#f8fafc',
      primaryStrong: '#f8fafc',
      muted: '#c7d2fe',
      secondary: '#dbeafe',
      accent: '#bfdbfe',
    },
    free: {
      fill: '#111827',
      fillTop: '#111827',
      fillBottom: '#111827',
      stroke: 'none',
      label: '#94a3b8',
      primary: '#94a3b8',
      primaryStrong: '#94a3b8',
      muted: '#64748b',
      secondary: '#6b7280',
      accent: '#64748b',
    },
  },
  'status-board': {
    occupied: {
      fill: '#1f2937',
      fillTop: '#1f2937',
      fillBottom: '#1f2937',
      stroke: 'none',
      label: '#e2e8f0',
      primary: '#f8fafc',
      primaryStrong: '#f8fafc',
      muted: '#cbd5e1',
      secondary: '#94a3b8',
      accent: '#cbd5e1',
    },
    free: {
      fill: '#0f172a',
      fillTop: '#0f172a',
      fillBottom: '#0f172a',
      stroke: 'none',
      label: '#94a3b8',
      primary: '#e2e8f0',
      primaryStrong: '#e2e8f0',
      muted: '#64748b',
      secondary: '#94a3b8',
      accent: '#94a3b8',
    },
  },
};

export const platformPaletteByAppearance: Record<
  RackAppearance,
  { fill: string; text: string }
> = {
  default: {
    fill: '#7c3aed',
    text: '#ffffff',
  },
  kiosk: {
    fill: '#6d28d9',
    text: '#f8fafc',
  },
  'status-board': {
    fill: '#4c1d95',
    text: '#f8fafc',
  },
};
