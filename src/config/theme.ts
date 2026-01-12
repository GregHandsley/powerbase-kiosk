export const brand = {
  bg: '#020617',
  panel: '#0b1224',
  border: '#1f2a44',
  text: '#f8fafc',
  muted: '#cbd5e1',
  primary: '#6366f1',
  accent: '#14b8a6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
};

export const sizing = {
  kioskTitle: '24px',
  kioskRackText: '16px',
  kioskMeta: '13px',
  adminTitle: '20px',
  adminBody: '14px',
  adminSmall: '12px',
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
};

export const theme = {
  brand,
  sizing,
  spacing,
};

export type Theme = typeof theme;
export type BrandColors = typeof brand;
export type SizingScale = typeof sizing;
export type SpacingScale = typeof spacing;

export default theme;
