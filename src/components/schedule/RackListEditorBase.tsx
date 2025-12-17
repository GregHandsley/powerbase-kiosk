import { useMemo } from "react";
import type { SideSnapshot } from "../../types/snapshot";
import { RackListEditorCore, type RackRow } from "./RackListEditorCore";

const makeBaseLayout = (): RackRow[] => [
  { id: "rack-3", label: "Rack 3", rackNumber: 3, gridColumn: 1, gridRow: 1 },
  { id: "rack-2", label: "Rack 2", rackNumber: 2, gridColumn: 1, gridRow: 2 },
  { id: "rack-1", label: "Rack 1", rackNumber: 1, gridColumn: 1, gridRow: 3 },
  { id: "rack-24", label: "Rack 24", rackNumber: 24, gridColumn: 1, gridRow: 4 },
  { id: "rack-23", label: "Rack 23", rackNumber: 23, gridColumn: 1, gridRow: 5 },
  { id: "rack-22", label: "Rack 22", rackNumber: 22, gridColumn: 1, gridRow: 6 },

  { id: "rack-4", label: "Rack 4", rackNumber: 4, gridColumn: 2, gridRow: 1 },
  { id: "rack-5", label: "Rack 5", rackNumber: 5, gridColumn: 2, gridRow: 2 },
  { id: "rack-6", label: "Rack 6", rackNumber: 6, gridColumn: 2, gridRow: 3 },
  { id: "rack-19", label: "Rack 19", rackNumber: 19, gridColumn: 2, gridRow: 4 },
  { id: "rack-20", label: "Rack 20", rackNumber: 20, gridColumn: 2, gridRow: 5 },
  { id: "rack-21", label: "Rack 21", rackNumber: 21, gridColumn: 2, gridRow: 6 },

  { id: "rack-9", label: "Rack 9", rackNumber: 9, gridColumn: 3, gridRow: 1 },
  { id: "rack-8", label: "Rack 8", rackNumber: 8, gridColumn: 3, gridRow: 2 },
  { id: "rack-7", label: "Rack 7", rackNumber: 7, gridColumn: 3, gridRow: 3 },
  { id: "rack-18", label: "Rack 18", rackNumber: 18, gridColumn: 3, gridRow: 4 },
  { id: "rack-17", label: "Rack 17", rackNumber: 17, gridColumn: 3, gridRow: 5 },
  { id: "rack-16", label: "Rack 16", rackNumber: 16, gridColumn: 3, gridRow: 6 },

  { id: "rack-10", label: "Rack 10", rackNumber: 10, gridColumn: 4, gridRow: 1 },
  { id: "rack-11", label: "Rack 11", rackNumber: 11, gridColumn: 4, gridRow: 2 },
  { id: "rack-12", label: "Rack 12", rackNumber: 12, gridColumn: 4, gridRow: 3 },
  { id: "rack-13", label: "Rack 13", rackNumber: 13, gridColumn: 4, gridRow: 4 },
  { id: "rack-14", label: "Rack 14", rackNumber: 14, gridColumn: 4, gridRow: 5 },
  { id: "rack-15", label: "Rack 15", rackNumber: 15, gridColumn: 4, gridRow: 6 },
];

// shift columns >=3 one to the right to create the center banner gap
const addColumnSpacer = (rows: RackRow[]): RackRow[] =>
  rows.map((r) => ({
    ...r,
    gridColumn: r.gridColumn >= 3 ? r.gridColumn + 1 : r.gridColumn,
  }));

// shift rows after row index down by one to create a horizontal walkway
const addRowSpacer = (rows: RackRow[], spacerAfterRow: number): RackRow[] =>
  rows.map((r) => ({
    ...r,
    gridRow: r.gridRow > spacerAfterRow ? r.gridRow + 1 : r.gridRow,
  }));

type Props = { snapshot: SideSnapshot | null };

export function RackListEditorBase({ snapshot }: Props) {
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
      bannerRowSpan="1 / span 7"
      showBanner
      gridTemplateColumns="repeat(2, 1fr) 0.25fr repeat(2, 1fr)"
      numRows={7}
      spacerRow={4}
    />
  );
}

