import { useMemo } from "react";
import type { SideSnapshot } from "../../types/snapshot";
import { RackListEditorCore } from "./RackListEditorCore";
import {
  makePowerLayout,
  addDoubleColumnSpacers,
  addRowSpacer,
} from "./shared/layouts";
import { POWER_GRID_CONFIG } from "./shared/gridConfig";

type Props = { snapshot: SideSnapshot | null };

export function RackListEditorPower({ snapshot }: Props) {
  const layout = useMemo(() => {
    if (!snapshot) return [];
    const withCols = addDoubleColumnSpacers(makePowerLayout());
    const withRow = addRowSpacer(withCols, 2);
    return withRow;
  }, [snapshot]);

  return (
    <RackListEditorCore
      snapshot={snapshot}
      layout={layout}
      bannerRowSpan={POWER_GRID_CONFIG.bannerRowSpan}
      showBanner={POWER_GRID_CONFIG.showBanner}
      gridTemplateColumns={POWER_GRID_CONFIG.gridTemplateColumns}
      numRows={POWER_GRID_CONFIG.numRows}
      spacerRow={POWER_GRID_CONFIG.spacerRow}
      side="power"
    />
  );
}

