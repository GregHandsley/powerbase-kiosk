import { Routes, Route, Link } from "react-router-dom";
import { Home } from "./pages/Home";
import { KioskPower } from "./pages/KioskPower";
import { KioskBase } from "./pages/KioskBase";
import { KioskStacked } from "./pages/KioskStacked";
import { Schedule } from "./pages/Schedule";
import { Admin } from "./pages/Admin";
import { TestLayout } from "./pages/TestLayout";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* simple header for dev; you can hide this later for kiosks */}
      <header className="px-4 py-3 border-b border-slate-700/60 bg-slate-950/70 backdrop-blur">
        <nav className="flex items-center gap-4 text-sm text-slate-200">
          <Link to="/" className="font-semibold tracking-wide">
            Powerbase Kiosk
          </Link>
          <Link to="/kiosk/power" className="hover:text-white">
            Kiosk Power
          </Link>
          <Link to="/kiosk/base" className="hover:text-white">
            Kiosk Base
          </Link>
          <Link to="/kiosk/stacked" className="hover:text-white">
            Kiosk Stacked
          </Link>
          <Link to="/schedule" className="hover:text-white">
            Schedule
          </Link>
          <Link to="/test-layout" className="hover:text-white">
            Test
          </Link>
          <Link to="/admin" className="hover:text-white ml-auto">
            Admin
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/kiosk/power" element={<KioskPower />} />
          <Route path="/kiosk/base" element={<KioskBase />} />
          <Route path="/kiosk/stacked" element={<KioskStacked />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/test-layout" element={<TestLayout />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  );
}
