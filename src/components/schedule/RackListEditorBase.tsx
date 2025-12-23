import { useMemo } from "react";
import type { SideSnapshot } from "../../types/snapshot";
import { RackListEditorCore } from "./RackListEditorCore";
import {
  makeBaseLayout,
  addColumnSpacer,
  addRowSpacer,
} from "./shared/layouts";
import { BASE_GRID_CONFIG } from "./shared/gridConfig";

type Props = { 
  snapshot: SideSnapshot | null;
  date: string;
  time: string;
};

export function RackListEditorBase({ snapshot, date, time }: Props) {
  const layout = useMemo(() => {
    if (!snapshot) return [];
    const withColSpacer = addColumnSpacer(makeBaseLayout());
    const withRowSpacer = addRowSpacer(withColSpacer, 3);
    return withRowSpacer;
  }, [snapshot]);

  return (
    <RackListEditorCore
      snapshot={snapshot}
      layout={layout}
      bannerRowSpan={BASE_GRID_CONFIG.bannerRowSpan}
      showBanner={BASE_GRID_CONFIG.showBanner}
      gridTemplateColumns={BASE_GRID_CONFIG.gridTemplateColumns}
      numRows={BASE_GRID_CONFIG.numRows}
      spacerRow={BASE_GRID_CONFIG.spacerRow}
      side="base"
      date={date}
      time={time}
    />
  );
}

