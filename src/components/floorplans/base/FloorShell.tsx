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
      <rect x={0} y={0} width={viewBoxWidth} height={viewBoxHeight} fill="#ffffff" />

      {/* main floor block as an L-shape with top-left cut-out */}
      <path
        d={`
          M ${cutoutRight} ${floorMargin}
          H ${viewBoxWidth - floorMargin}
          V ${viewBoxHeight - floorMargin}
          H ${floorMargin}
          V ${floorMargin + cutoutHeight}
          H ${cutoutRight}
          Z
        `}
        fill="#bfbfbf"
        stroke="#666666"
        strokeWidth={0.8}
      />

      {/* bottom-left BIKE/MET CON AREA */}
      <rect
        x={floorMargin + 2}
        y={44}
        width={15}
        height={41}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={floorMargin + 10}
        y={65}
        textAnchor="middle"
        fontSize={2}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        <tspan x={floorMargin + 10} dy={0}>
          BIKE/MET
        </tspan>
        <tspan x={floorMargin + 10} dy={4}>
          CON AREA
        </tspan>
      </text>

      {/* large bottom-left MACHINES box */}
      <rect
        x={floorMargin + 19}
        y={48}
        width={33}
        height={37}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={floorMargin + 36}
        y={68}
        textAnchor="middle"
        fontSize={4}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        MACHINES
      </text>

      {/* top-left dumbbell box */}
      <rect
        x={floorMargin + 42}
        y={5}
        width={10}
        height={37}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={floorMargin + 47}
        y={20}
        textAnchor="middle"
        fontSize={1.5}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        <tspan x={floorMargin + 47} dy={0}>
          DUMBELL
        </tspan>
        <tspan x={floorMargin + 47} dy={4}>
          WEIGHT
        </tspan>
        <tspan x={floorMargin + 47} dy={4}>
          AREA
        </tspan>
      </text>

      {/* right machines vertical strip */}
      <rect
        x={viewBoxWidth - floorMargin - 16}
        y={5}
        width={10}
        height={37}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={viewBoxWidth - floorMargin - 10}
        y={23}
        textAnchor="middle"
        fontSize={2}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
        transform={`rotate(-90 ${viewBoxWidth - floorMargin - 10} 23)`}
      >
        MACHINES
      </text>

      {/* right-top stairs strip */}
      <rect x={viewBoxWidth - floorMargin - 4} y={5} width={3} height={37.5} fill="#facc15" />
      {Array.from({ length: 13 }).map((_, i) => (
        <rect
          key={i}
          x={viewBoxWidth - floorMargin - 3.8}
          y={7 + i * 2.8}
          width={2.6}
          height={0.8}
          fill="#fde68a"
        />
      ))}

      {/* bottom-right DB WEIGHT AREA */}
      <rect
        x={viewBoxWidth - floorMargin - 16}
        y={48}
        width={14}
        height={37}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={viewBoxWidth - floorMargin - 14}
        y={64}
        textAnchor="middle"
        fontSize={2}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        <tspan x={viewBoxWidth - floorMargin - 9} dy={0}>
          DUMBELL
        </tspan>
        <tspan x={viewBoxWidth - floorMargin - 9} dy={4}>
          WEIGHT
        </tspan>
        <tspan x={viewBoxWidth - floorMargin - 9} dy={4}>
          AREA
        </tspan>
      </text>

      {/* central vertical text */}
      <text
        x={80}
        y={65}
        textAnchor="middle"
        fontSize={5}
        fill="#4b5563"
        fontFamily="system-ui, sans-serif"
        transform="rotate(-90 80 45)"
      >
        WHERE HISTORY BEGINS
      </text>
    </>
  );
}

