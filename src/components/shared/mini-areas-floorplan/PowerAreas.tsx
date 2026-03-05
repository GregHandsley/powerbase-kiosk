import { VIEWBOX_WIDTH, VIEWBOX_HEIGHT, FLOOR_MARGIN } from './constants';
import { AreaCell } from './AreaCell';
import type { ActiveInstance } from '../../../types/snapshot';

type AreaConfig = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string[];
};

const POWER_AREAS_CONFIG: AreaConfig[] = [
  {
    key: 'dumbbell',
    x: FLOOR_MARGIN,
    y: FLOOR_MARGIN + 29,
    w: 25,
    h: 34,
    label: ['DUMBBELLS'],
  },
  {
    key: 'cables',
    x: FLOOR_MARGIN,
    y: VIEWBOX_HEIGHT - FLOOR_MARGIN - 20,
    w: 25,
    h: 20,
    label: ['CABLES'],
  },
  {
    key: 'fixed_machines',
    x: FLOOR_MARGIN + 35,
    y: FLOOR_MARGIN + 30,
    w: 35,
    h: 55,
    label: ['MACHINES'],
  },
];

const WEIGHT_LIFTING = {
  key: 'weight_lifting' as const,
  x: 75,
  y: VIEWBOX_HEIGHT - FLOOR_MARGIN - 85,
  w: 45,
  h: 29,
  label: 'Weight Lifting Area',
};

const FUNCTIONAL = {
  key: 'functional' as const,
  x: 75,
  y: VIEWBOX_HEIGHT - FLOOR_MARGIN - 29,
  w: 45,
  h: 30,
  label: 'Functional Area',
};

const TRACK = {
  key: 'track' as const,
  x: VIEWBOX_WIDTH - FLOOR_MARGIN - 35,
  y: FLOOR_MARGIN - 1,
  w: 35,
  h: VIEWBOX_HEIGHT - FLOOR_MARGIN - 1,
  label: 'Track',
};

type Props = {
  selectedSet: Set<string>;
  onAreaClick: (key: string) => void;
  isAreaVisible: (key: string) => boolean;
  areasInteractive: boolean;
  bookedAreaKeys?: Set<string>;
  freeIntervalsByArea?: Map<string, Array<{ start: string; end: string }>>;
  areaBookingByKey?: Map<string, ActiveInstance>;
};

function makeClickable(
  key: string,
  areasInteractive: boolean,
  bookedAreaKeys?: Set<string>,
  freeIntervalsByArea?: Map<string, Array<{ start: string; end: string }>>
) {
  return (
    areasInteractive &&
    !(bookedAreaKeys?.has(key) && !freeIntervalsByArea?.has(key))
  );
}

export function PowerAreas({
  selectedSet,
  onAreaClick,
  isAreaVisible,
  areasInteractive,
  bookedAreaKeys,
  freeIntervalsByArea,
  areaBookingByKey,
}: Props) {
  return (
    <>
      {POWER_AREAS_CONFIG.map((area) => {
        if (!isAreaVisible(area.key)) return null;
        const selected = selectedSet.has(area.key);
        const isPartiallyAvailable = freeIntervalsByArea?.has(area.key);
        const isFullyBooked = !!(
          bookedAreaKeys?.has(area.key) && !isPartiallyAvailable
        );
        const clickable = areasInteractive && !isFullyBooked;
        return (
          <AreaCell
            key={area.key}
            areaKey={area.key}
            x={area.x}
            y={area.y}
            w={area.w}
            h={area.h}
            label={area.label}
            selected={selected}
            isFullyBooked={isFullyBooked}
            isPartiallyAvailable={!!isPartiallyAvailable}
            areaBookingByKey={areaBookingByKey}
            onClick={() => onAreaClick(area.key)}
            clickable={clickable}
          />
        );
      })}
      {isAreaVisible('weight_lifting') && (
        <AreaCell
          areaKey="weight_lifting"
          x={WEIGHT_LIFTING.x}
          y={WEIGHT_LIFTING.y}
          w={WEIGHT_LIFTING.w}
          h={WEIGHT_LIFTING.h}
          label={[WEIGHT_LIFTING.label]}
          selected={selectedSet.has('weight_lifting')}
          isFullyBooked={
            !!(
              bookedAreaKeys?.has('weight_lifting') &&
              !freeIntervalsByArea?.has('weight_lifting')
            )
          }
          isPartiallyAvailable={!!freeIntervalsByArea?.has('weight_lifting')}
          areaBookingByKey={areaBookingByKey}
          onClick={() => onAreaClick('weight_lifting')}
          clickable={makeClickable(
            'weight_lifting',
            areasInteractive,
            bookedAreaKeys,
            freeIntervalsByArea
          )}
        />
      )}
      {isAreaVisible('functional') && (
        <AreaCell
          areaKey="functional"
          x={FUNCTIONAL.x}
          y={FUNCTIONAL.y}
          w={FUNCTIONAL.w}
          h={FUNCTIONAL.h}
          label={[FUNCTIONAL.label]}
          selected={selectedSet.has('functional')}
          isFullyBooked={
            !!(
              bookedAreaKeys?.has('functional') &&
              !freeIntervalsByArea?.has('functional')
            )
          }
          isPartiallyAvailable={!!freeIntervalsByArea?.has('functional')}
          areaBookingByKey={areaBookingByKey}
          onClick={() => onAreaClick('functional')}
          clickable={makeClickable(
            'functional',
            areasInteractive,
            bookedAreaKeys,
            freeIntervalsByArea
          )}
        />
      )}
      {isAreaVisible('track') && (
        <AreaCell
          areaKey="track"
          x={TRACK.x}
          y={TRACK.y}
          w={TRACK.w}
          h={TRACK.h}
          label={[TRACK.label]}
          selected={selectedSet.has('track')}
          isFullyBooked={
            !!(
              bookedAreaKeys?.has('track') && !freeIntervalsByArea?.has('track')
            )
          }
          isPartiallyAvailable={!!freeIntervalsByArea?.has('track')}
          areaBookingByKey={areaBookingByKey}
          onClick={() => onAreaClick('track')}
          clickable={makeClickable(
            'track',
            areasInteractive,
            bookedAreaKeys,
            freeIntervalsByArea
          )}
          labelFontSize={2.8}
        />
      )}
      <rect
        x={FLOOR_MARGIN + 65}
        y={FLOOR_MARGIN + 0.5}
        width={5}
        height={26}
        fill="rgba(30, 41, 59, 0.6)"
        stroke="rgba(71, 85, 105, 0.25)"
        strokeWidth={0.3}
        rx={1}
      />
    </>
  );
}
