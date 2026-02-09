import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AspectRatio } from '../components/AspectRatio';
import { BaseFloorplan } from '../components/floorplans/base/BaseFloorplan';
import { KioskFrame } from '../components/KioskFrame';
import { parseRatioParam } from '../lib/parseRatio';
import type { SideSnapshot } from '../types/snapshot';

const STATIC_SNAPSHOT: SideSnapshot = {
  at: '2026-02-02T12:00:00.000Z',
  sideId: 1,
  currentInstances: [
    {
      instanceId: 101,
      bookingId: 201,
      start: '2026-02-02T11:00:00.000Z',
      end: '2026-02-02T12:30:00.000Z',
      racks: [1, 2],
      areas: [],
      title: 'Team Alpha',
      color: null,
      isLocked: false,
      createdBy: null,
      status: 'confirmed',
    },
    {
      instanceId: 102,
      bookingId: 202,
      start: '2026-02-02T11:15:00.000Z',
      end: '2026-02-02T12:15:00.000Z',
      racks: [7],
      areas: [],
      title: 'Speed Work',
      color: null,
      isLocked: false,
      createdBy: null,
      status: 'confirmed',
    },
    {
      instanceId: 103,
      bookingId: 203,
      start: '2026-02-02T10:30:00.000Z',
      end: '2026-02-02T12:00:00.000Z',
      racks: [16, 17],
      areas: [],
      title: 'Power Session',
      color: null,
      isLocked: false,
      createdBy: null,
      status: 'confirmed',
    },
  ],
  nextUseByRack: {
    '3': { start: '2026-02-02T12:30:00.000Z', title: 'Team Beta' },
    '4': { start: '2026-02-02T12:15:00.000Z', title: 'Open Gym' },
    '8': { start: '2026-02-02T12:45:00.000Z', title: 'Recovery' },
    '18': { start: '2026-02-02T12:30:00.000Z', title: 'Strength' },
  },
  nextUseByArea: {},
};

export function KioskBaseStatic() {
  const [search] = useSearchParams();
  const ratio = parseRatioParam(search.get('ratio'), 16 / 9);
  const first = STATIC_SNAPSHOT.currentInstances[0];
  const slotLabel =
    first && first.start && first.end
      ? `${format(new Date(first.start), 'HH:mm')}–${format(new Date(first.end), 'HH:mm')}`
      : null;

  useEffect(() => {
    document.body.classList.add('kiosk-mode');
    return () => {
      document.body.classList.remove('kiosk-mode');
    };
  }, []);

  return (
    <KioskFrame
      title="Base (Static Sample)"
      slotLabel={slotLabel}
      sideKey="Base"
    >
      <AspectRatio ratio={ratio}>
        <div className="w-full h-full kiosk-floorplan">
          <BaseFloorplan snapshot={STATIC_SNAPSHOT} appearance="kiosk" />
        </div>
      </AspectRatio>
    </KioskFrame>
  );
}
