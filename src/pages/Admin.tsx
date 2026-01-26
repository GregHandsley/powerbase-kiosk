import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { CapacityManagement } from '../components/admin/CapacityManagement';
import { PeriodTypeCapacityManagement } from '../components/admin/PeriodTypeCapacityManagement';
import { NotificationSettings } from '../components/admin/notification-settings/NotificationSettings';
import { BrandingSettings } from '../components/admin/branding/BrandingSettings';
import { InvitationManagement } from '../components/admin/invitations/InvitationManagement';
import { AuditLog } from '../components/admin/audit/AuditLog';
import { ActivityLog } from '../components/admin/activity/ActivityLog';
import { AnnouncementManagement } from '../components/admin/announcements/AnnouncementManagement';
import { Clock } from '../components/Clock';
import {
  usePermission,
  usePrimaryOrganizationId,
} from '../hooks/usePermissions';

export function Admin() {
  const { user, profile, role, loading, signOut, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showCreateInvitationForm, setShowCreateInvitationForm] =
    useState(false);
  const [exportHandler, setExportHandler] = useState<(() => void) | null>(null);
  const [hasUnsavedNotificationChanges, setHasUnsavedNotificationChanges] =
    useState(false);
  const location = useLocation();

  // Determine which view to show based on URL search params
  const view =
    new URLSearchParams(location.search).get('view') || 'capacity-schedule';
  const viewLabelMap: Record<
    string,
    { crumb: string; title: string; subtitle: string }
  > = {
    'capacity-schedule': {
      crumb: 'Capacity Schedule',
      title: 'Capacity Schedule',
      subtitle: 'Manage capacity schedules by time and day.',
    },
    'period-capacity': {
      crumb: 'Period Capacity',
      title: 'Period Capacity',
      subtitle: 'Set defaults and overrides for period capacity.',
    },
    'notification-settings': {
      crumb: 'Notification Settings',
      title: 'System Notification Settings',
      subtitle:
        'Admin: Configure system-wide notification behavior, windows, and reminder schedules.',
    },
    branding: {
      crumb: 'Branding',
      title: 'Branding',
      subtitle: 'Customize colors and logo for your organization.',
    },
    invitations: {
      crumb: 'Invitations',
      title: 'Invitation Management',
      subtitle: 'Create and manage user invitations.',
    },
    audit: {
      crumb: 'Audit Log',
      title: 'Audit Log',
      subtitle: 'Review system changes and admin actions.',
    },
    activity: {
      crumb: 'Activity Log',
      title: 'Activity Log',
      subtitle: 'Track booking and operational activity.',
    },
    announcements: {
      crumb: 'Announcements',
      title: 'System Announcements',
      subtitle:
        'Create and manage system-wide announcements shown to users on login.',
    },
  };
  const viewMeta = viewLabelMap[view] ?? {
    crumb: 'Admin',
    title: 'Admin',
    subtitle: 'Manage system settings and organization tools.',
  };
  const { organizationId: primaryOrgId } = usePrimaryOrganizationId();
  const { hasPermission: canCreateInvitations } = usePermission(
    primaryOrgId,
    'invitations.create'
  );

  const showSpinner = (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
      <div className="text-slate-300 text-sm">Loading...</div>
    </div>
  );

  if (loading) return showSpinner;

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm glass-panel rounded-2xl p-6 space-y-3">
          <div>
            <h1 className="text-lg font-semibold mb-1 text-slate-100">
              Admin Login
            </h1>
            <p className="text-xs text-slate-300">
              Sign in with your Supabase account to access admin tools.
            </p>
          </div>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginError(null);
              setLoginLoading(true);
              const { error } = await signIn(email.trim(), password);
              if (error) {
                setLoginError(error);
              }
              setLoginLoading(false);
            }}
          >
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-200">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-200">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {loginError && <p className="text-xs text-red-400">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 inline-flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium py-1.5 disabled:opacity-60"
            >
              {loginLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Only admins can access this page
  if (role !== 'admin') {
    return (
      <div className="p-4 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Admin Dashboard</h1>
            <p className="text-slate-300 text-sm">
              You are signed in as{' '}
              <span className="font-mono">{user.email}</span>, but admin access
              is required for this page.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Clock />
            <button
              onClick={signOut}
              className="text-xs text-slate-300 hover:text-white underline"
            >
              Sign out
            </button>
          </div>
        </header>
      </div>
    );
  }

  const displayName = profile?.full_name || user.email || 'Unknown';

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Collapsible Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        roleLabel={role ?? 'unknown'}
        displayName={displayName}
        onSignOut={signOut}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden border-l border-white/5 bg-slate-950/40">
        <div className="px-8 py-6 border-b border-white/5">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Admin <span className="mx-1">→</span> {viewMeta.crumb}
          </div>
          <div className="mt-4 flex items-start justify-between gap-6">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">
                {viewMeta.title}
              </h1>
              <p className="text-sm text-slate-300 mt-1">{viewMeta.subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              {view === 'notification-settings' &&
                hasUnsavedNotificationChanges && (
                  <div className="text-xs text-yellow-400 bg-yellow-900/20 px-3 py-1.5 rounded border border-yellow-700">
                    Unsaved changes
                  </div>
                )}
              {(view === 'audit' || view === 'activity') && exportHandler && (
                <button
                  onClick={exportHandler}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md transition-colors"
                >
                  Export CSV
                </button>
              )}
              {view === 'invitations' && canCreateInvitations && (
                <button
                  onClick={() =>
                    setShowCreateInvitationForm(!showCreateInvitationForm)
                  }
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md transition-colors"
                >
                  {showCreateInvitationForm ? 'Cancel' : '+ Create Invitation'}
                </button>
              )}
            </div>
          </div>
        </div>
        <main
          className={`flex-1 px-8 py-6 ${view === 'branding' ? 'overflow-y-auto' : 'overflow-hidden'}`}
        >
          {view === 'capacity-schedule' && <CapacityManagement />}
          {view === 'period-capacity' && <PeriodTypeCapacityManagement />}
          {view === 'notification-settings' && (
            <NotificationSettings
              onUnsavedChangesChange={setHasUnsavedNotificationChanges}
            />
          )}
          {view === 'branding' && <BrandingSettings />}
          {view === 'invitations' && (
            <InvitationManagement
              showCreateForm={showCreateInvitationForm}
              setShowCreateForm={setShowCreateInvitationForm}
            />
          )}
          {view === 'audit' && <AuditLog setExportHandler={setExportHandler} />}
          {view === 'activity' && (
            <ActivityLog setExportHandler={setExportHandler} />
          )}
          {view === 'announcements' && <AnnouncementManagement />}
        </main>
      </div>
    </div>
  );
}
