import { Routes, Route, Link, useLocation } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { Home } from "./pages/Home";
import { KioskPower } from "./pages/KioskPower";
import { KioskBase } from "./pages/KioskBase";
import { LiveView } from "./pages/LiveView";
import { Schedule } from "./pages/Schedule";
import { Bookings } from "./pages/Bookings";
import { Admin } from "./pages/Admin";
import { TestLayout } from "./pages/TestLayout";
import { KioskErrorScreen } from "./components/KioskErrorScreen";

export default function App() {
  const { pathname } = useLocation();
  const showHeader = !pathname.startsWith("/kiosk");

  return (
    <div className="min-h-screen flex flex-col">
      {/* simple header for dev; hidden on kiosk routes */}
      {showHeader && (
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
          <Link to="/live-view" className="hover:text-white">
            Live View
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
      )}

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/kiosk/power"
            element={
              <ErrorBoundary FallbackComponent={KioskErrorScreen}>
                <KioskPower />
              </ErrorBoundary>
            }
          />
          <Route
            path="/kiosk/base"
            element={
              <ErrorBoundary FallbackComponent={KioskErrorScreen}>
                <KioskBase />
              </ErrorBoundary>
            }
          />
          <Route path="/live-view" element={<LiveView />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/test-layout" element={<TestLayout />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  );
}
