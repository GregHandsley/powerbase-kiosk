import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { KioskPower } from './pages/KioskPower';
import { KioskBase } from './pages/KioskBase';
import { LiveView } from './pages/LiveView';
import { Schedule } from './pages/Schedule';
import { Bookings } from './pages/Bookings';
import { MyBookings } from './pages/MyBookings';
import { BookingsTeam } from './pages/BookingsTeam';
import { Admin } from './pages/Admin';
import { KioskErrorScreen } from './components/KioskErrorScreen';
import { TaskBell } from './components/tasks/TaskBell';
import { useAuth } from './context/AuthContext';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-300 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const showHeader =
    !pathname.startsWith('/kiosk') && !pathname.startsWith('/login');

  // Show only login page if not authenticated
  if (!loading && !user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-300 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* simple header for dev; hidden on kiosk routes */}
      {showHeader && (
        <header className="px-4 py-3 border-b border-slate-700/60 bg-slate-950/70 backdrop-blur">
          <nav className="flex items-center gap-4 text-sm text-slate-200">
            <Link to="/" className="font-semibold tracking-wide">
              Facility OS
            </Link>
            <Link to="/live-view" className="hover:text-white">
              Session View
            </Link>
            <Link to="/schedule" className="hover:text-white">
              Schedule
            </Link>
            <Link to="/my-bookings" className="hover:text-white">
              My Bookings
            </Link>
            <Link to="/bookings-team" className="hover:text-white">
              Bookings Team
            </Link>
            <div className="ml-auto flex items-center gap-4">
              {user && <TaskBell />}
              <Link to="/admin" className="hover:text-white">
                Admin
              </Link>
            </div>
          </nav>
        </header>
      )}

      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kiosk/power"
            element={
              <ProtectedRoute>
                <ErrorBoundary FallbackComponent={KioskErrorScreen}>
                  <KioskPower />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kiosk/base"
            element={
              <ProtectedRoute>
                <ErrorBoundary FallbackComponent={KioskErrorScreen}>
                  <KioskBase />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/live-view"
            element={
              <ProtectedRoute>
                <LiveView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <Schedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings-team"
            element={
              <ProtectedRoute>
                <BookingsTeam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <Bookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
