import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

export function useDragSensors() {
  return useSensors(
    // PointerSensor for mouse - minimal activation distance for fluid dragging
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    // TouchSensor for touch screens - use distance instead of delay for better responsiveness
    useSensor(TouchSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
}
