type Props = {
  gridColumn: number;
  gridRow: string;
};

export function Banner({ gridColumn, gridRow }: Props) {
  return (
    <div
      style={{
        gridColumn,
        gridRow,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        writingMode: "vertical-rl",
        textOrientation: "mixed",
        fontSize: "32px",
        letterSpacing: "0.3em",
        color: "rgba(148, 163, 184, 0.8)",
        fontWeight: 600,
      }}
    >
      WHERE HISTORY BEGINS
    </div>
  );
}

