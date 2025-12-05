import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";
import { useSnapshot } from "../lib/hooks/useSnapshot";
import type { ActiveInstance } from "../lib/types";

export function KioskStacked() {
  const { snapshot, error } = useSnapshot();

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
          padding: 8,
          boxSizing: "border-box",
        }}
      >
        <Clock />
        <h1 style={{ fontSize: 18 }}>Stacked Snapshot</h1>
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          at: {snapshot?.at ?? "loading..."}
        </p>
        {error && <p style={{ color: "red" }}>Error: {error}</p>}

        <div style={{ flex: 1, borderBottom: "1px solid #444", overflow: "auto" }}>
          <h2>Power</h2>
          {snapshot && snapshot.power.currentInstances.length > 0 ? (
            <ul>
              {snapshot.power.currentInstances.map((inst: ActiveInstance) => (
                <li key={inst.id}>
                  <strong>{inst.title}</strong> racks {inst.racks.join(", ")}
                </li>
              ))}
            </ul>
          ) : (
            <p>No active bookings.</p>
          )}
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <h2>Base</h2>
          {snapshot && snapshot.base.currentInstances.length > 0 ? (
            <ul>
              {snapshot.base.currentInstances.map((inst: ActiveInstance) => (
                <li key={inst.id}>
                  <strong>{inst.title}</strong> racks {inst.racks.join(", ")}
                </li>
              ))}
            </ul>
          ) : (
            <p>No active bookings.</p>
          )}
        </div>
      </div>
    </AspectRatio>
  );
}
