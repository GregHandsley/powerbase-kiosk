import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";

export function KioskPower() {
  return (
    <AspectRatio ratio={16 / 9}>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#222",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <Clock />
        <div>
          <h1 style={{ fontSize: 32, textAlign: "center" }}>Power — Kiosk</h1>
          <p style={{ textAlign: "center", marginTop: 8 }}>
            Placeholder floorplan (SVG goes here)
          </p>
        </div>
      </div>
    </AspectRatio>
  );
}
