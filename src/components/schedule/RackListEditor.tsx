import type { SideSnapshot } from '../../types/snapshot';
import type { ActiveInstance } from '../../types/snapshot';
import { RackListEditorBase } from './RackListEditorBase';
import { RackListEditorPower } from './RackListEditorPower';

type Props = {
  side: 'power' | 'base';
  snapshot: SideSnapshot | null;
  date: string;
  time: string;
  /** When true, clicking a booking shows read-only info instead of opening the editor. */
  viewOnly?: boolean;
  /** When viewOnly and provided, clicking a booking calls this (e.g. Session View edit). */
  onEditBooking?: (booking: ActiveInstance) => void;
};

export function RackListEditor({
  side,
  snapshot,
  date,
  time,
  viewOnly,
  onEditBooking,
}: Props) {
  if (side === 'base') {
    return (
      <RackListEditorBase
        snapshot={snapshot}
        date={date}
        time={time}
        viewOnly={viewOnly}
        onEditBooking={onEditBooking}
      />
    );
  }
  return (
    <RackListEditorPower
      snapshot={snapshot}
      date={date}
      time={time}
      viewOnly={viewOnly}
      onEditBooking={onEditBooking}
    />
  );
}
