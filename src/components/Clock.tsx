import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 20,
        fontSize: 24,
        fontFamily: "system-ui, sans-serif",
        color: "white",
      }}
    >
      {now.toLocaleTimeString()}
    </div>
  );
}
