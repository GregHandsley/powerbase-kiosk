import type { RackLayoutSlot } from './RackSlot';
import { RackSlot } from './RackSlot';
import type { ActiveInstance, NextUseInfo } from '../../../types/snapshot';

type Props = {
  slot: RackLayoutSlot;
  currentInst: ActiveInstance | null;
  nextUse: NextUseInfo | null;
  snapshotDate: Date;
  /** Whether this rack is selected for editing */
  isSelected: boolean;
  /** Whether this rack is disabled (used by another booking) */
  isDisabled?: boolean;
  /** Whether this rack can be clicked (not disabled) */
  isClickable: boolean;
  /** Callback when rack is clicked */
  onClick: (rackNumber: number) => void;
};

/**
 * An editable version of RackSlot that can be clicked to select/deselect.
 * Shows a visual indicator when selected.
 */
export function EditableRackSlot({
  slot,
  currentInst,
  nextUse,
  snapshotDate,
  isSelected,
  isDisabled = false,
  isClickable,
  onClick,
}: Props) {
  const handleClick = () => {
    if (isClickable) {
      onClick(slot.number);
    }
  };

  return (
    <g
      onClick={handleClick}
      style={{
        cursor: isClickable ? 'pointer' : 'not-allowed',
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {/* Original rack slot */}
      <RackSlot
        slot={slot}
        currentInst={currentInst}
        nextUse={nextUse}
        snapshotDate={snapshotDate}
      />

      {/* Selection indicator (selected for editing) */}
      {isSelected && (
        <rect
          x={slot.x}
          y={slot.y}
          width={slot.width}
          height={slot.height}
          rx={2}
          ry={2}
          fill="rgba(99, 102, 241, 0.3)"
          stroke="#6366f1"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}

      {/* Disabled overlay (grayed out for other bookings) */}
      {isDisabled && (
        <rect
          x={slot.x}
          y={slot.y}
          width={slot.width}
          height={slot.height}
          rx={2}
          ry={2}
          fill="rgba(0, 0, 0, 0.4)"
          pointerEvents="none"
        />
      )}

      {/* Clickable overlay for better UX */}
      {isClickable && (
        <rect
          x={slot.x}
          y={slot.y}
          width={slot.width}
          height={slot.height}
          rx={2}
          ry={2}
          fill="transparent"
          pointerEvents="all"
        />
      )}
    </g>
  );
}
