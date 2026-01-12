import theme, { brand, sizing, spacing } from './theme.js';

export type Theme = typeof theme;
export type BrandColors = typeof brand;
export type SizingScale = typeof sizing;
export type SpacingScale = typeof spacing;

export { theme, brand, sizing, spacing };
