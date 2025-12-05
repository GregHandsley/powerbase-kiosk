import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";
import { useSideSnapshot } from "../lib/hooks/useSideSnapshot";
import type { ActiveInstance } from "../lib/types";

export function KioskPower() {
  const { snapshot, error } = useSideSnapshot("Power");

  return (
    <AspectRatio ratio={16 / 9}>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#222",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: 16,
          boxSizing: "border-box",
        }}
      >
        <Clock />
        <h1>Power — Live Snapshot</h1>
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          at: {snapshot?.at ?? "loading..."}
        </p>
        {error && <p style={{ color: "red" }}>Error: {error}</p>}

        <h2>Current Instances</h2>
        {snapshot && snapshot.currentInstances.length > 0 ? (
          <ul>
            {snapshot.currentInstances.map((inst: ActiveInstance) => (
              <li key={inst.id}>
                <strong>{inst.title}</strong> ({inst.start} → {inst.end}) racks{" "}
                {inst.racks.join(", ")} areas {inst.areas.join(", ")}
              </li>
            ))}
          </ul>
        ) : (
          <p>No active bookings.</p>
        )}

        <h2>Next use by rack</h2>
        <pre style={{ fontSize: 11 }}>
          {snapshot ? JSON.stringify(snapshot.nextUseByRack, null, 2) : "loading..."}
        </pre>
      </div>
    </AspectRatio>
  );
}
