import "../shared/floorplan.css";

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
      <rect className="fp-bg-outer" x={0} y={0} width={viewBoxWidth} height={viewBoxHeight} />

      {/* main floor block as an L-shape with top-left cut-out */}
      <path
        className="fp-bg-path"
        d={`
          M ${cutoutRight} ${floorMargin}
          H ${viewBoxWidth - floorMargin}
          V ${viewBoxHeight - floorMargin}
          H ${floorMargin}
          V ${floorMargin + cutoutHeight}
          H ${cutoutRight}
          Z
        `}
      />

      {/* bottom-left BIKE/MET CON AREA */}
      <g transform={`translate(${floorMargin + 2} 44)`}>
        <rect className="fp-area" width={15} height={41} />
        <text
          className="fp-area-label"
          x={15 / 2}
          y={41 / 2 - 1.5}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          BIKE/MET
        </text>
        <text
          className="fp-area-label"
          x={15 / 2}
          y={41 / 2 + 2.5}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          CON AREA
        </text>
      </g>

      {/* large bottom-left MACHINES box */}
      <g transform={`translate(${floorMargin + 19} 48)`}>
        <rect className="fp-area" width={33} height={37} />
        <text
          className="fp-area-label"
          x={33 / 2}
          y={37 / 2}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          MACHINES
        </text>
      </g>

      {/* top-left dumbbell box */}
      <g transform={`translate(${floorMargin + 42} 5)`}>
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

      {/* right machines vertical strip */}
      <g transform={`translate(${viewBoxWidth - floorMargin - 16} 5)`}>
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

      {/* right-top stairs strip */}
      <rect
        className="fp-stairs-main"
        x={viewBoxWidth - floorMargin - 4}
        y={5}
        width={3}
        height={37.5}
      />
      {Array.from({ length: 13 }).map((_, i) => (
        <rect
          key={i}
          className="fp-stairs-step"
          x={viewBoxWidth - floorMargin - 3.8}
          y={7 + i * 2.8}
          width={2.6}
          height={0.8}
        />
      ))}

      {/* bottom-right DB WEIGHT AREA */}
      <g transform={`translate(${viewBoxWidth - floorMargin - 16} 48)`}>
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
        x={80}
        y={65}
        textAnchor="middle"
        fontSize={5}
        transform="rotate(-90 80 45)"
      >
        WHERE HISTORY BEGINS
      </text>
    </>
  );
}

