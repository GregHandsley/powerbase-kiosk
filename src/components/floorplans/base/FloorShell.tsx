import '../../../styles/floorplan.css';

/** Area keys for SVG data-area-key; must match floorplanAreaKeys.ts and DB areas.key */
const AREA_KEY = {
  BIKE_MET_CON: 'bike_met_con',
  MACHINES_1: 'machines_1',
  MACHINES_2: 'machines_2',
  DUMBBELL_1: 'dumbbell_1',
  DUMBBELL_2: 'dumbbell_2',
  WEIGHT_LIFTING: 'weight_lifting',
} as const;

type Props = {
  viewBoxWidth: number;
  viewBoxHeight: number;
  floorMargin: number;
  cutoutWidth: number;
  cutoutHeight: number;
};

export function FloorShell({
  viewBoxWidth,
  viewBoxHeight,
  floorMargin,
  cutoutWidth,
  cutoutHeight,
}: Props) {
  const cutoutRight = floorMargin + cutoutWidth;

  return (
    <>
      {/* outer background */}
      <rect
        className="fp-bg-outer"
        x={0}
        y={0}
        width={viewBoxWidth}
        height={viewBoxHeight}
      />

      {/* main floor block as an L-shape with bottom-right cut-out */}
      <path
        className="fp-bg-path"
        d={`
          M ${viewBoxWidth - cutoutRight} ${viewBoxHeight - floorMargin}
          H ${floorMargin}
          V ${floorMargin}
          H ${viewBoxWidth - floorMargin}
          V ${viewBoxHeight - floorMargin - cutoutHeight}
          H ${viewBoxWidth - cutoutRight}
          Z
        `}
      />

      {/* top-right BIKE/MET CON AREA */}
      <g
        data-area-key={AREA_KEY.BIKE_MET_CON}
        transform={`translate(${viewBoxWidth - floorMargin - 29.5} ${floorMargin + 2})`}
      >
        <rect className="fp-area" width={27.5} height={41} />
        <text
          className="fp-area-label"
          x={27.5 / 2}
          y={41 / 2 - 1.5}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          BIKE/MET
        </text>
        <text
          className="fp-area-label"
          x={27.5 / 2}
          y={41 / 2 + 2.5}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          CON AREA
        </text>
      </g>

      {/* "You are here" indicator below BIKE/MET CON AREA */}
      <g
        transform={`translate(${viewBoxWidth - floorMargin - 29.5 + 27.5 / 2} ${floorMargin + 2 + 41 + 4})`}
        className="fp-you-are-here"
      >
        {/* Pulsing rings (no gradients/filters for stability) */}
        <circle
          className="fp-you-here-ring"
          cx={0}
          cy={0}
          r={6}
          fill="none"
          stroke="rgba(96, 165, 250, 0.55)"
          strokeWidth={0.6}
        />
        <circle
          className="fp-you-here-ring fp-you-here-ring--delay"
          cx={0}
          cy={0}
          r={4.5}
          fill="none"
          stroke="rgba(96, 165, 250, 0.35)"
          strokeWidth={0.6}
        />
        {/* Core dot */}
        <circle
          className="fp-location-dot"
          cx={0}
          cy={0}
          r={2}
          fill="#f8fafc"
        />
      </g>
      <g
        transform={`translate(${viewBoxWidth - floorMargin - 29.5 + 27.5 / 2} ${floorMargin + 2 + 41 + 4})`}
        className="fp-you-are-here-static"
      >
        {/* "You are here" text */}
        <text
          className="fp-you-are-here-text"
          x={0}
          y={8}
          textAnchor="middle"
          dominantBaseline="hanging"
        >
          You are here
        </text>
      </g>

      {/* large top-right MACHINES 1 */}
      <g
        data-area-key={AREA_KEY.MACHINES_1}
        transform={`translate(${viewBoxWidth - floorMargin - 52} ${floorMargin + 2})`}
      >
        <rect className="fp-area" width={20} height={37} />
        <text
          className="fp-area-label"
          x={21 / 2}
          y={37 / 2}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          MACHINES
        </text>
      </g>

      {/* bottom-left DUMBBELL 1 */}
      <g
        data-area-key={AREA_KEY.DUMBBELL_1}
        transform={`translate(${viewBoxWidth - floorMargin - 52} ${viewBoxHeight - floorMargin - 38})`}
      >
        <rect className="fp-area" width={10} height={37} />
        <text
          className="fp-area-label-small"
          x={10 / 2}
          y={37 / 2 - 1}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          DUMBELL
        </text>
        <text
          className="fp-area-label-small"
          x={10 / 2}
          y={37 / 2 + 2.5}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          AREA
        </text>
      </g>

      {/* left MACHINES 2 vertical strip */}
      <g
        data-area-key={AREA_KEY.MACHINES_2}
        transform={`translate(${floorMargin + 5} ${viewBoxHeight - floorMargin - 38})`}
      >
        <rect className="fp-area" width={10} height={37} />
        <text
          className="fp-area-label"
          x={10 / 2}
          y={37 / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90 ${10 / 2} ${37 / 2})`}
        >
          MACHINES
        </text>
      </g>

      {/* left-bottom stairs strip */}
      <rect
        className="fp-stairs-main"
        x={floorMargin - 0.3}
        y={viewBoxHeight - floorMargin - 38}
        width={3}
        height={37}
      />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          className="fp-stairs-step"
          x={floorMargin - 0.1}
          y={viewBoxHeight - floorMargin - 5 - 37.5 + 7 + i * 2.8}
          width={2.6}
          height={0.8}
        />
      ))}

      {/* top-left DUMBBELL 2 (was "DB WEIGHT AREA") */}
      <g
        data-area-key={AREA_KEY.DUMBBELL_2}
        transform={`translate(${viewBoxWidth - floorMargin - 151.5} ${floorMargin + 2})`}
      >
        <rect className="fp-area" width={14} height={37} />
        <text
          className="fp-area-label-small"
          x={14 / 2}
          y={37 / 2 - 1}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          DUMBELL
        </text>
        <text
          className="fp-area-label-small"
          x={14 / 2}
          y={37 / 2 + 2.5}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          AREA
        </text>
      </g>

      {/* central vertical text */}
      <text
        className="fp-vertical-text"
        x={(viewBoxWidth - 76 + viewBoxWidth - 103 - 17) / 2}
        y={viewBoxHeight / 2}
        textAnchor="middle"
        fontSize={5}
        transform={`rotate(-90 ${(viewBoxWidth - 73 + viewBoxWidth - 103 - 17) / 2} ${viewBoxHeight / 2})`}
      >
        WHERE HISTORY BEGINS
      </text>
    </>
  );
}
