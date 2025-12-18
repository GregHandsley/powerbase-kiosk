/**
 * Grid configuration for Base side
 */
export const BASE_GRID_CONFIG = {
  gridTemplateColumns: "repeat(2, 1fr) 0.25fr repeat(2, 1fr)",
  numRows: 7,
  spacerRow: 4,
  bannerRowSpan: "1 / span 7",
  showBanner: true,
} as const;

/**
 * Grid configuration for Power side
 */
export const POWER_GRID_CONFIG = {
  gridTemplateColumns: "repeat(2, 1fr) 0.2fr 1fr 0.2fr 1fr",
  numRows: 6,
  spacerRow: 3,
  bannerRowSpan: "1 / span 6",
  showBanner: false,
} as const;

/**
 * Get grid configuration for a given side
 */
export function getGridConfig(side: "base" | "power") {
  return side === "base" ? BASE_GRID_CONFIG : POWER_GRID_CONFIG;
}

