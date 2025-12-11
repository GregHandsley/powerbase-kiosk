// Static SVG floor layout for Powerbase – updated with platforms and full racks.
export function PowerbaseFloorSvg() {
  // ---- canvas + margins ----
  const viewBoxWidth = 160;
  const viewBoxHeight = 90;
  const floorMargin = 3;

  // ---- rack geometry ----
  const rackWidth = 9;
  const rackHeight = 8;
  const rackGapX = 7;
  const rackGapY = 5;

  // positions for rack columns (centre grid)
  const labelColX = 90; // vertical 16–20 column
  const col1X = labelColX + 7; // left rack column
  const col2X = col1X + rackWidth + rackGapX; // middle rack/platform column
  const col3X = col2X + rackWidth + rackGapX; // right rack column

  const topRowY = 15;
  const rowY = (row: number) => topRowY + row * (rackHeight + rackGapY);

  // numbers for left + right rack columns
  const col1Numbers = [9, 10, 11, 12, 13];
  const col3Numbers = [1, 2, 3, 4, 5];

  // label column (now full racks)
  const labelRackNumbers = [16, 17, 18, 19, 20];

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* outer background */}
      <rect x={0} y={0} width={viewBoxWidth} height={viewBoxHeight} fill="#ffffff" />

      {/* main floor rectangle */}
      <rect
        x={floorMargin}
        y={floorMargin}
        width={viewBoxWidth - floorMargin * 2}
        height={viewBoxHeight - floorMargin * 2}
        fill="#d4d4d4"
        stroke="#9ca3af"
        strokeWidth={0.8}
      />

      {/* LEFT: Dumbbell Area */}
      <rect
        x={floorMargin + 2}
        y={floorMargin + 2}
        width={23}
        height={55}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={floorMargin + 16.5}
        y={floorMargin + 28}
        textAnchor="middle"
        fontSize={3}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        <tspan x={floorMargin + 14} dy={0}>
          Dumbbell
        </tspan>
        <tspan x={floorMargin + 13.5} dy={4}>
          Area
        </tspan>
      </text>

      {/* LEFT: Cables */}
      <rect
        x={floorMargin + 2}
        y={viewBoxHeight - floorMargin - 25}
        width={23}
        height={23}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={floorMargin + 13.5}
        y={viewBoxHeight - floorMargin - 13}
        textAnchor="middle"
        fontSize={3}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        Cables
      </text>

      {/* MID-LEFT: Fixed Resistance Machines */}
      <rect
        x={floorMargin + 33}
        y={floorMargin + 15}
        width={30}
        height={48}
        fill="#707070"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={floorMargin + 48}
        y={floorMargin + 32}
        textAnchor="middle"
        fontSize={3}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        <tspan x={floorMargin + 48} dy={0}>
          Fixed
        </tspan>
        <tspan x={floorMargin + 48} dy={4}>
          Resistance
        </tspan>
        <tspan x={floorMargin + 48} dy={4}>
          Machines
        </tspan>
      </text>

      {/* RIGHT: Track */}
      <rect
        x={viewBoxWidth - floorMargin - 16}
        y={floorMargin + 6}
        width={14}
        height={viewBoxHeight - floorMargin * 2 - 8}
        fill="#f97316"
        stroke="#6b21a8"
        strokeWidth={0.8}
      />
      <text
        x={viewBoxWidth - floorMargin - 9}
        y={viewBoxHeight / 2}
        textAnchor="middle"
        fontSize={3}
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
        transform={`rotate(-90 ${viewBoxWidth - floorMargin - 9} ${viewBoxHeight / 2})`}
      >
        Track
      </text>

      {/* YELLOW STAIRS – top centre */}
      <rect
        x={labelColX - 8}
        y={floorMargin + 2}
        width={5}
        height={18}
        fill="#facc15"
      />
      {Array.from({ length: 10 }).map((_, i) => (
        <rect
          key={`top-step-${i}`}
          x={labelColX - 7.7}
          y={floorMargin + 4 + i * 1.5}
          width={4.4}
          height={0.7}
          fill="#fde68a"
        />
      ))}

      {/* FULL-SIZE RACK LABEL COLUMN: 16–20 */}
      {labelRackNumbers.map((num, row) => {
        const y = rowY(row);
        return (
          <g key={`label-${num}`}>
            <rect
              x={labelColX}
              y={y}
              width={rackWidth}
              height={rackHeight}
              fill="#7c3aed"
              stroke="#6b21a8"
              strokeWidth={0.8}
            />
            <text
              x={labelColX + rackWidth / 2}
              y={y + rackHeight / 2 - 1.5}
              textAnchor="middle"
              fontSize={2.4}
              fill="#ffffff"
              fontFamily="system-ui, sans-serif"
            >
              RACK
            </text>
            <text
              x={labelColX + rackWidth / 2}
              y={y + rackHeight / 2 + 2}
              textAnchor="middle"
              fontSize={2.6}
              fill="#ffffff"
              fontFamily="system-ui, sans-serif"
            >
              {num}
            </text>
          </g>
        );
      })}

      {/* LEFT COLUMN: RACKS 9–13 */}
      {col1Numbers.map((num, row) => {
        const x = col1X;
        const y = rowY(row);
        return (
          <g key={`r${num}`}>
            <rect
              x={x}
              y={y}
              width={rackWidth}
              height={rackHeight}
              fill="#7c3aed"
              stroke="#6b21a8"
              strokeWidth={0.8}
            />
            <text
              x={x + rackWidth / 2}
              y={y + rackHeight / 2 - 1.5}
              textAnchor="middle"
              fontSize={2.4}
              fill="#ffffff"
              fontFamily="system-ui, sans-serif"
            >
              RACK
            </text>
            <text
              x={x + rackWidth / 2}
              y={y + rackHeight / 2 + 2}
              textAnchor="middle"
              fontSize={2.6}
              fill="#ffffff"
              fontFamily="system-ui, sans-serif"
            >
              {num}
            </text>
          </g>
        );
      })}

      {/* MIDDLE COLUMN: PLATFORMS + RACKS 6–8 */}
      {Array.from({ length: 5 }).map((_, row) => {
        const x = col2X;
        const y = rowY(row);

        // first two rows = platforms
        if (row === 0 || row === 1) {
          const platformNumber = row + 1;
          return (
            <g key={`platform-${platformNumber}`}>
              <rect
                x={x}
                y={y}
                width={rackWidth}
                height={rackHeight}
                fill="#7c3aed"
                stroke="#6b21a8"
                strokeWidth={0.8}
              />
              <text
                x={x + rackWidth / 2}
                y={y + rackHeight / 2 - 1.5}
                textAnchor="middle"
                fontSize={2.2}
                fill="#ffffff"
                fontFamily="system-ui, sans-serif"
              >
                PLATFORM
              </text>
              <text
                x={x + rackWidth / 2}
                y={y + rackHeight / 2 + 2}
                textAnchor="middle"
                fontSize={2.6}
                fill="#ffffff"
                fontFamily="system-ui, sans-serif"
              >
                {platformNumber}
              </text>
            </g>
          );
        }

        // remaining rows = racks 6–8
        const rackNumber = 6 + (row - 2); // rows 2,3,4 => 6,7,8
        return (
          <g key={`r${rackNumber}`}>
            <rect
              x={x}
              y={y}
              width={rackWidth}
              height={rackHeight}
              fill="#7c3aed"
              stroke="#6b21a8"
              strokeWidth={0.8}
            />
            <text
              x={x + rackWidth / 2}
              y={y + rackHeight / 2 - 1.5}
              textAnchor="middle"
              fontSize={2.4}
              fill="#ffffff"
              fontFamily="system-ui, sans-serif"
            >
              RACK
            </text>
            <text
              x={x + rackWidth / 2}
              y={y + rackHeight / 2 + 2}
              textAnchor="middle"
              fontSize={2.6}
              fill="#ffffff"
              fontFamily="system-ui, sans-serif"
            >
              {rackNumber}
            </text>
          </g>
        );
      })}

      {/* RIGHT COLUMN: RACKS 1–5 */}
      {col3Numbers.map((num, row) => {
        const x = col3X;
        const y = rowY(row);
        return (
          <g key={`r${num}`}>
            <rect
              x={x}
              y={y}
              width={rackWidth}
              height={rackHeight}
              fill="#7c3aed"
              stroke="#6b21a8"
              strokeWidth={0.8}
            />
            <text
              x={x + rackWidth / 2}
              y={y + rackHeight / 2 - 1.5}
              textAnchor="middle"
              fontSize={2.4}
              fill="#ffffff"
              fontFamily="system-ui, sans-serif"
            >
              RACK
            </text>
            <text
              x={x + rackWidth / 2}
              y={y + rackHeight / 2 + 2}
              textAnchor="middle"
              fontSize={2.6}
              fill="#ffffff"
              fontFamily="system-ui, sans-serif"
            >
              {num}
            </text>
          </g>
        );
      })}

      {/* slogan */}
      <text
        x={viewBoxWidth - 47}
        y={viewBoxHeight - 7}
        textAnchor="middle"
        fontSize={3.5}
        fill="#4b5563"
        fontFamily="system-ui, sans-serif"
      >
        WHERE HISTORY BEGINS
      </text>
    </svg>
  );
}