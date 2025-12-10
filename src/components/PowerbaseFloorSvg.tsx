// Static SVG floor layout for Powerbase testing.
export function PowerbaseFloorSvg() {
    // ---- basic layout numbers ----
    const viewBoxWidth = 160;
    const viewBoxHeight = 90;
    const floorMargin = 3;
  
    // RACK SIZE
    const rackWidth = 17;   // change for wider/narrower racks
    const rackHeight = 11;  // height
    const rackGapY = 2;
  
    // X positions for each rack column
    const col1X = 57;  // column: 3,2,1,24,23,22
    const col2X = 76;  // column: 4,5,6,19,20,21
    const col3X = 103; // column: 9,8,7,18,17,16
    const col4X = 122; // column: 10,11,12,13,14,15
  
    // ---- Y positions per column (move “quadrants” by changing these) ----
    // column 1
    const col1TopY = 5;
    const col1BottomY = 48;
  
    // column 2
    const col2TopY = 5;
    const col2BottomY = 48;
  
    // column 3
    const col3TopY = 5;
    const col3BottomY = 48;
  
    // column 4
    const col4TopY = 5;
    const col4BottomY = 48;
  
    // size of the top-left cut-out (white area)
    const cutoutWidth = 40;
    const cutoutHeight = 39;
    const cutoutRight = floorMargin + cutoutWidth;
  
    // helper to build a single vertical column of racks
    const buildColumn = (
      x: number,
      topY: number,
      bottomY: number,
      topNums: number[],
      bottomNums: number[]
    ) => {
      const racks: { number: number; x: number; y: number }[] = [];
  
      topNums.forEach((num, i) => {
        racks.push({
          number: num,
          x,
          y: topY + i * (rackHeight + rackGapY),
        });
      });
  
      bottomNums.forEach((num, i) => {
        racks.push({
          number: num,
          x,
          y: bottomY + i * (rackHeight + rackGapY),
        });
      });
  
      return racks;
    };
  
    const racks = [
      ...buildColumn(col1X, col1TopY, col1BottomY, [3, 2, 1], [24, 23, 22]),
      ...buildColumn(col2X, col2TopY, col2BottomY, [4, 5, 6], [19, 20, 21]),
      ...buildColumn(col3X, col3TopY, col3BottomY, [9, 8, 7], [18, 17, 16]),
      ...buildColumn(col4X, col4TopY, col4BottomY, [10, 11, 12], [13, 14, 15]),
    ];
  
    return (
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
      >
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
  
        {/* bottom-centre MACHINES */}
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
  
        {/* top-left vertical DB WEIGHT AREA */}
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
  
        {/* right-top MACHINES vertical block */}
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
        <rect
          x={viewBoxWidth - floorMargin - 4}
          y={5}
          width={3}
          height={37.5}
          fill="#facc15"
        />
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
  
        {/* all racks */}
        {racks.map((rack) => (
          <g key={rack.number}>
            <rect
              x={rack.x}
              y={rack.y}
              width={rackWidth}
              height={rackHeight}
              fill="#7c3aed"
              stroke="#6b21a8"
              strokeWidth={0.8}
            />
            <text
              x={rack.x + rackWidth / 2}
              y={rack.y + rackHeight / 2 - 2}
              textAnchor="middle"
              fontSize={3}
              fill="#ffffff"
              fontFamily="system-ui, sans-serif"
            >
              RACK
            </text>
            <text
              x={rack.x + rackWidth / 2}
              y={rack.y + rackHeight / 2 + 2}
              textAnchor="middle"
              fontSize={3}
              fill="#ffffff"
              fontFamily="system-ui, sans-serif"
            >
              {rack.number}
            </text>
          </g>
        ))}
      </svg>
    );
  }
  