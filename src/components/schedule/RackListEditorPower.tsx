import { useMemo } from "react";
import type { SideSnapshot } from "../../types/snapshot";
import { RackListEditorCore, type RackRow } from "./RackListEditorCore";

const makePowerLayout = (): RackRow[] => [
  // col1
  { id: "rack-14", label: "Rack 14", rackNumber: 14, gridColumn: 1, gridRow: 1 },
  { id: "rack-15", label: "Rack 15", rackNumber: 15, gridColumn: 1, gridRow: 2 },
  { id: "rack-16", label: "Rack 16", rackNumber: 16, gridColumn: 1, gridRow: 3 },
  { id: "rack-17", label: "Rack 17", rackNumber: 17, gridColumn: 1, gridRow: 4 },
  { id: "rack-18", label: "Rack 18", rackNumber: 18, gridColumn: 1, gridRow: 5 },
  // col2
  { id: "rack-9", label: "Rack 9", rackNumber: 9, gridColumn: 2, gridRow: 1 },
  { id: "rack-10", label: "Rack 10", rackNumber: 10, gridColumn: 2, gridRow: 2 },
  { id: "rack-11", label: "Rack 11", rackNumber: 11, gridColumn: 2, gridRow: 3 },
  { id: "rack-12", label: "Rack 12", rackNumber: 12, gridColumn: 2, gridRow: 4 },
  { id: "rack-13", label: "Rack 13", rackNumber: 13, gridColumn: 2, gridRow: 5 },
  // col3 (platforms 1-2 non-bookable, then racks 6-8)
  { id: "platform-1", label: "Platform 1", rackNumber: null, gridColumn: 3, gridRow: 1, disabled: true },
  { id: "platform-2", label: "Platform 2", rackNumber: null, gridColumn: 3, gridRow: 2, disabled: true },
  { id: "rack-6", label: "Rack 6", rackNumber: 6, gridColumn: 3, gridRow: 3 },
  { id: "rack-7", label: "Rack 7", rackNumber: 7, gridColumn: 3, gridRow: 4 },
  { id: "rack-8", label: "Rack 8", rackNumber: 8, gridColumn: 3, gridRow: 5 },
  // col4
  { id: "rack-1", label: "Rack 1", rackNumber: 1, gridColumn: 4, gridRow: 1 },
  { id: "rack-2", label: "Rack 2", rackNumber: 2, gridColumn: 4, gridRow: 2 },
  { id: "rack-3", label: "Rack 3", rackNumber: 3, gridColumn: 4, gridRow: 3 },
  { id: "rack-4", label: "Rack 4", rackNumber: 4, gridColumn: 4, gridRow: 4 },
  { id: "rack-5", label: "Rack 5", rackNumber: 5, gridColumn: 4, gridRow: 5 },
];

// Insert two gaps:
// - after column 2 (center gap)
// - after column 3 (gap between platforms/6-8 and racks 1-5)
// Mapping: col1->1, col2->2, col3->4, col4->6 (gaps at 3 and 5)
const addDoubleColumnSpacers = (rows: RackRow[]): RackRow[] =>
  rows.map((r) => {
    if (r.gridColumn === 3) return { ...r, gridColumn: 4 };
    if (r.gridColumn >= 4) return { ...r, gridColumn: r.gridColumn + 2 };
    return r;
  });

// Insert a walkway row between row 2 and 3 (shift rows > 2 down by 1)
const addRowSpacer = (rows: RackRow[], spacerAfterRow: number): RackRow[] =>
  rows.map((r) => ({
    ...r,
    gridRow: r.gridRow > spacerAfterRow ? r.gridRow + 1 : r.gridRow,
  }));

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
      bannerRowSpan="1 / span 6"
      gridTemplateColumns="repeat(2, 1fr) 0.2fr 1fr 0.2fr 1fr"
      numRows={6}
      spacerRow={3}
    />
  );
}

