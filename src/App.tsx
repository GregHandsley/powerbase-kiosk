import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { AcceptInvite } from './pages/AcceptInvite';
import { KioskPower } from './pages/KioskPower';
import { KioskBase } from './pages/KioskBase';
import { KioskWayfinding } from './pages/KioskWayfinding';
import { LiveView } from './pages/LiveView';
import { Schedule } from './pages/Schedule';
import { Bookings } from './pages/Bookings';
import { MyBookings } from './pages/MyBookings';
import { BookingsTeam } from './pages/BookingsTeam';
import { Admin } from './pages/Admin';
import { Profile } from './pages/Profile';
import { KioskErrorScreen } from './components/KioskErrorScreen';
import { TaskBell } from './components/tasks/TaskBell';
import { NotificationBell } from './components/notifications/NotificationBell';
import { FeedbackButton } from './components/shared/FeedbackButton';
import { AnnouncementModal } from './components/shared/AnnouncementModal';
import { useAuth } from './context/AuthContext';
import { useAnnouncements } from './hooks/useAnnouncements';
import { useState, useEffect } from 'react';
import { useBranding } from './context/BrandingContext';
import {
  usePermission,
  usePrimaryOrganizationId,
} from './hooks/usePermissions';

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
  const { branding } = useBranding();
  const { organizationId: primaryOrgId } = usePrimaryOrganizationId();
  const { hasPermission: canViewAllBookings } = usePermission(
    primaryOrgId,
    'bookings.view_all'
  );
  const {
    announcements,
    hasNewAnnouncements,
    acknowledge,
    isAcknowledging,
    isLoading: isLoadingAnnouncements,
  } = useAnnouncements();
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  // Show announcement modal when there are new announcements and user is logged in
  useEffect(() => {
    if (
      !loading &&
      !isLoadingAnnouncements &&
      user &&
      hasNewAnnouncements &&
      !showAnnouncementModal
    ) {
      console.log('Showing announcement modal', {
        announcements,
        hasNewAnnouncements,
      });
      setShowAnnouncementModal(true);
    }
  }, [
    loading,
    isLoadingAnnouncements,
    user,
    hasNewAnnouncements,
    showAnnouncementModal,
    announcements,
  ]);

  const showHeader =
    !pathname.startsWith('/kiosk') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/accept-invite');

  // Show only public kiosk + auth pages if not authenticated
  if (!loading && !user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
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
        <Route
          path="/kiosk/wayfinding"
          element={
            <ErrorBoundary FallbackComponent={KioskErrorScreen}>
              <KioskWayfinding />
            </ErrorBoundary>
          }
        />
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
        <header className="relative z-[70] px-4 py-3 glass-header">
          <nav className="flex items-center gap-4 text-sm text-slate-200">
            <Link
              to="/"
              className="flex items-center gap-2 font-semibold tracking-wide"
            >
              {branding?.logo_url && (
                <img
                  src={branding.logo_url}
                  alt="Organization logo"
                  className="h-6 w-6 object-contain"
                />
              )}
              <span>Facility OS</span>
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
            {canViewAllBookings && (
              <Link to="/bookings-team" className="hover:text-white">
                Bookings Team
              </Link>
            )}
            <div className="ml-auto flex items-center gap-4">
              {user && <NotificationBell />}
              {user && <TaskBell />}
              <Link to="/profile" className="hover:text-white">
                Profile
              </Link>
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
          <Route
            path="/kiosk/wayfinding"
            element={
              <ErrorBoundary FallbackComponent={KioskErrorScreen}>
                <KioskWayfinding />
              </ErrorBoundary>
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
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showHeader && <FeedbackButton />}
      <AnnouncementModal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        announcements={announcements}
        onAcknowledge={acknowledge}
        isAcknowledging={isAcknowledging}
      />
    </div>
  );
}
