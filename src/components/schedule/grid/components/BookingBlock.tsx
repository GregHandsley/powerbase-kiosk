import { format } from "date-fns";
import type { BookingBlock as BookingBlockType } from "../types";

type Props = {
  block: BookingBlockType;
  onClick?: (booking: BookingBlockType["booking"]) => void;
};

export function BookingBlock({ block, onClick }: Props) {
  return (
    <div
      className="absolute left-0 right-0 border-l-4 border-t border-b border-r rounded-sm cursor-pointer transition-opacity hover:opacity-90 shadow-md flex flex-col items-center justify-center p-2 z-5"
      style={{
        top: 0,
        height: `${block.rowSpan * 50}px`,
        zIndex: 6, // Bookings on top
        margin: "2px 4px",
        left: "4px",
        right: "4px",
        backgroundColor: block.booking.color
          ? `${block.booking.color}40`
          : "rgba(99, 102, 241, 0.3)", // indigo fallback
        borderColor: block.booking.color
          ? block.booking.color
          : "rgb(99, 102, 241)",
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) {
          onClick(block.booking);
        }
      }}
    >
      <div
        className="text-sm font-semibold text-center px-1 break-words"
        style={{
          color: block.booking.color || "rgb(199, 210, 254)",
        }}
      >
        {block.booking.title}
      </div>
      <div
        className="text-xs mt-1 text-center px-1"
        style={{
          color: block.booking.color || "rgb(199, 210, 254)",
        }}
      >
        {format(new Date(block.booking.start), "HH:mm")} -{" "}
        {format(new Date(block.booking.end), "HH:mm")}
      </div>
    </div>
  );
}

