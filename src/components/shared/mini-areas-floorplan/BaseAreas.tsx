import { VIEWBOX_HEIGHT, FLOOR_MARGIN } from './constants';
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

const BASE_AREAS_CONFIG: AreaConfig[] = [
  {
    key: 'bike_met_con',
    x: 160 - FLOOR_MARGIN - 42,
    y: FLOOR_MARGIN,
    w: 42,
    h: 37,
    label: ['BIKE/MET', 'CON AREA'],
  },
  {
    key: 'machines_1',
    x: 160 - FLOOR_MARGIN - 85,
    y: FLOOR_MARGIN,
    w: 40,
    h: 37,
    label: ['MACHINES'],
  },
  {
    key: 'dumbbell_1',
    x: 160 - FLOOR_MARGIN - 85,
    y: VIEWBOX_HEIGHT - FLOOR_MARGIN - 45,
    w: 30,
    h: 45,
    label: ['DUMBBELLS'],
  },
  {
    key: 'dumbbell_2',
    x: 160 - FLOOR_MARGIN - 154,
    y: FLOOR_MARGIN,
    w: 35,
    h: 37,
    label: ['DUMBBELLS'],
  },
];

type Props = {
  selectedSet: Set<string>;
  onAreaClick: (key: string) => void;
  isAreaVisible: (key: string) => boolean;
  areasInteractive: boolean;
  bookedAreaKeys?: Set<string>;
  freeIntervalsByArea?: Map<string, Array<{ start: string; end: string }>>;
  areaBookingByKey?: Map<string, ActiveInstance>;
};

export function BaseAreas({
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
      {BASE_AREAS_CONFIG.map((area) => {
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
      {isAreaVisible('machines_2') && (
        <g
          onClick={
            areasInteractive &&
            !(
              bookedAreaKeys?.has('machines_2') &&
              !freeIntervalsByArea?.has('machines_2')
            )
              ? () => onAreaClick('machines_2')
              : undefined
          }
          style={
            areasInteractive &&
            !(
              bookedAreaKeys?.has('machines_2') &&
              !freeIntervalsByArea?.has('machines_2')
            )
              ? { cursor: 'pointer' }
              : bookedAreaKeys?.has('machines_2')
                ? { cursor: 'not-allowed' }
                : undefined
          }
          transform={`translate(${FLOOR_MARGIN} ${VIEWBOX_HEIGHT - FLOOR_MARGIN - 44})`}
        >
          <AreaCell
            areaKey="machines_2"
            x={0}
            y={0}
            w={35}
            h={44}
            label={['MACHINES']}
            selected={selectedSet.has('machines_2')}
            isFullyBooked={
              !!(
                bookedAreaKeys?.has('machines_2') &&
                !freeIntervalsByArea?.has('machines_2')
              )
            }
            isPartiallyAvailable={!!freeIntervalsByArea?.has('machines_2')}
            areaBookingByKey={areaBookingByKey}
            onClick={() => onAreaClick('machines_2')}
            clickable={
              areasInteractive &&
              !(
                bookedAreaKeys?.has('machines_2') &&
                !freeIntervalsByArea?.has('machines_2')
              )
            }
          />
        </g>
      )}
    </>
  );
}
