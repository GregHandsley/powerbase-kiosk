import { Routes, Route, Link } from "react-router-dom";
import { KioskPower } from "./pages/KioskPower.tsx";
import { KioskBase } from "./pages/KioskBase.tsx";
import { KioskStacked } from "./pages/KioskStacked.tsx";
import { Schedule } from "./pages/Schedule.tsx";
import { Admin } from "./pages/Admin.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/kiosk/power" element={<KioskPower />} />
      <Route path="/kiosk/base" element={<KioskBase />} />
      <Route path="/kiosk/stacked" element={<KioskStacked />} />

      <Route path="/schedule" element={<Schedule />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

function Home() {
  return (
    <div style={{ 
      padding: 20, 
      fontFamily: "system-ui, sans-serif",
      maxWidth: "1280px",
      margin: "0 auto",
      textAlign: "center"
    }}>
      <h1>Powerbase Kiosk</h1>
      <p>Sprint 0 — shell & routing</p>
      <ul>
        <li><Link to="/kiosk/power">Kiosk — Power</Link></li>
        <li><Link to="/kiosk/base">Kiosk — Base</Link></li>
        <li><Link to="/kiosk/stacked">Kiosk — Stacked</Link></li>
        <li><Link to="/schedule">Schedule (coach view)</Link></li>
        <li><Link to="/admin">Admin</Link></li>
      </ul>
    </div>
  );
}
