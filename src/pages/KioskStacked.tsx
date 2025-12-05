import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";

export function KioskStacked() {
  return (
    <AspectRatio ratio={9 / 16}>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#111",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Clock />
        <div style={{ flex: 1, borderBottom: "1px solid #444" }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div>
              <h2 style={{ textAlign: "center" }}>Power — Top</h2>
              <p style={{ textAlign: "center" }}>Placeholder floorplan</p>
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div>
              <h2 style={{ textAlign: "center" }}>Base — Bottom</h2>
              <p style={{ textAlign: "center" }}>Placeholder floorplan</p>
            </div>
          </div>
        </div>
      </div>
    </AspectRatio>
  );
}
