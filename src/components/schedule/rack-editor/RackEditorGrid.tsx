import type { ReactNode } from "react";
import type { RackRow } from "../RackListEditorCore";
import type { ActiveInstance } from "../../../types/snapshot";
import { DraggableBooking } from "../DraggableBooking";
import { RackRowDroppable } from "../RackRowDroppable";
import { Banner } from "./Banner";
import { buildGridTemplateRows } from "./utils";

type Props = {
  layout: RackRow[];
  assignments: Map<number, number[]>;
  bookingById: Map<number, ActiveInstance>;
  activeId: string | null;
  beforeRacks?: ReactNode;
  showBanner: boolean;
  bannerRowSpan: string;
  gridTemplateColumns: string;
  numRows: number;
  spacerRow?: number;
  BASE_WIDTH: number;
  BASE_HEIGHT: number;
  zoomLevel: number;
};

export function RackEditorGrid({
  layout,
  assignments,
  bookingById,
  activeId,
  beforeRacks,
  showBanner,
  bannerRowSpan,
  gridTemplateColumns,
  numRows,
  spacerRow,
  BASE_WIDTH,
  BASE_HEIGHT,
  zoomLevel,
}: Props) {
  return (
    <div
      style={{
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        display: "grid",
        gridTemplateColumns,
        gridTemplateRows: buildGridTemplateRows(numRows, spacerRow),
        columnGap: "20px",
        rowGap: "20px",
        padding: "24px",
        zoom: zoomLevel,
        transformOrigin: "top left",
        fontSize: "18px",
      }}
    >
      {beforeRacks}
      {showBanner && <Banner gridColumn={3} gridRow={bannerRowSpan} />}
      {layout.map((row) => {
        const bookingEntry =
          row.rackNumber !== null
            ? [...assignments.entries()].find(([, rackNos]) => rackNos.includes(row.rackNumber!))
            : null;
        const bookingId = bookingEntry?.[0] ?? null;
        const booking = bookingId ? bookingById.get(bookingId) ?? null : null;

        const content = booking ? (
          <DraggableBooking booking={booking} fromRack={row.rackNumber!} activeId={activeId} />
        ) : row.disabled ? (
          <span className="text-slate-600">Not bookable</span>
        ) : (
          <span className="text-slate-500">Drop booking here</span>
        );

        return (
          <RackRowDroppable
            key={row.id}
            row={row}
            booking={booking ?? null}
            bookingContent={content}
            style={{
              gridColumn: row.gridColumn,
              gridRow: row.gridRow,
            }}
          />
        );
      })}
    </div>
  );
}

