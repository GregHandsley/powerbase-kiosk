import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  roleLabel: string;
  displayName: string;
  onSignOut: () => void;
};

export function AdminSidebar({
  isOpen,
  onToggle,
  roleLabel,
  displayName,
  onSignOut,
}: Props) {
  const location = useLocation();
  const { isSuperAdmin } = useAuth();

  const menuItems = [
    {
      path: '/admin?view=capacity-schedule',
      label: 'Capacity Schedule',
    },
    {
      path: '/admin?view=period-capacity',
      label: 'Period Capacity',
    },
    {
      path: '/admin?view=notification-settings',
      label: 'Notification Settings',
    },
    {
      path: '/admin?view=branding',
      label: 'Branding',
      requiresSuperAdmin: true,
    },
    {
      path: '/admin?view=invitations',
      label: 'Invitations',
    },
    {
      path: '/admin?view=audit',
      label: 'Audit Log',
    },
    {
      path: '/admin?view=activity',
      label: 'Activity Log',
    },
    {
      path: '/admin?view=announcements',
      label: 'Announcements',
      requiresSuperAdmin: true,
    },
  ].filter((item) => (item.requiresSuperAdmin ? isSuperAdmin : true));

  return (
    <>
      {/* Sidebar */}
      <aside
        className={clsx(
          'bg-slate-950/40 border-r border-white/5 transition-all duration-300 flex flex-col shrink-0',
          isOpen ? 'w-52' : 'w-0 overflow-hidden'
        )}
      >
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold tracking-[0.2em] text-slate-500">
              ADMIN
            </h2>
            <button
              onClick={onToggle}
              className="p-1 rounded hover:bg-slate-800/60 text-slate-500 hover:text-slate-200"
              aria-label="Toggle sidebar"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-400 truncate">
            <span className="text-slate-100 font-medium">{displayName}</span>
            <span className="mx-1">·</span>
            <span className="capitalize">{roleLabel}</span>
          </div>
        </div>

        <nav className="flex-1 px-4 pb-4 pt-2 space-y-1.5">
          {menuItems.map((item) => {
            const currentView =
              new URLSearchParams(location.search).get('view') ||
              'capacity-schedule';
            const itemView = item.path.split('view=')[1];
            const isActive =
              location.pathname === '/admin' && currentView === itemView;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-normal transition-colors',
                  isActive
                    ? 'bg-indigo-500/20 text-slate-100'
                    : 'text-slate-300/80 hover:bg-slate-800/40 hover:text-slate-100'
                )}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-white/5">
          <button
            onClick={onSignOut}
            className="w-full text-xs text-slate-300 hover:text-white underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Toggle button when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-slate-800 border-r border-y border-slate-700 rounded-r-md text-slate-400 hover:text-slate-200 hover:bg-slate-700"
          aria-label="Open sidebar"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}
    </>
  );
}
