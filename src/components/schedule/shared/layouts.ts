import type { RackRow } from "../RackListEditorCore";

/**
 * Base side rack layout definition
 */
export function makeBaseLayout(): RackRow[] {
  return [
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
}

/**
 * Power side rack layout definition
 */
export function makePowerLayout(): RackRow[] {
  return [
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
}

/**
 * Shift columns >= threshold one to the right to create the center banner gap (Base)
 */
export function addColumnSpacer(rows: RackRow[], threshold: number = 3): RackRow[] {
  return rows.map((r) => ({
    ...r,
    gridColumn: r.gridColumn >= threshold ? r.gridColumn + 1 : r.gridColumn,
  }));
}

/**
 * Shift rows after row index down by one to create a horizontal walkway
 */
export function addRowSpacer(rows: RackRow[], spacerAfterRow: number): RackRow[] {
  return rows.map((r) => ({
    ...r,
    gridRow: r.gridRow > spacerAfterRow ? r.gridRow + 1 : r.gridRow,
  }));
}

/**
 * Power side column spacers - inserts two gaps:
 * - after column 2 (center gap)
 * - after column 3 (gap between platforms/6-8 and racks 1-5)
 * Mapping: col1->1, col2->2, col3->4, col4->6 (gaps at 3 and 5)
 */
export function addDoubleColumnSpacers(rows: RackRow[]): RackRow[] {
  return rows.map((r) => {
    if (r.gridColumn === 3) return { ...r, gridColumn: 4 };
    if (r.gridColumn >= 4) return { ...r, gridColumn: r.gridColumn + 2 };
    return r;
  });
}

