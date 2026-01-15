import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

type Props = {
  isOpen: boolean;
  onToggle: () => void;
};

export function AdminSidebar({ isOpen, onToggle }: Props) {
  const location = useLocation();

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
      path: '/admin?view=invitations',
      label: 'Invitations',
    },
  ];

  return (
    <>
      {/* Sidebar */}
      <aside
        className={clsx(
          'bg-slate-900 border-r border-slate-700 transition-all duration-300 flex flex-col shrink-0',
          isOpen ? 'w-64' : 'w-0 overflow-hidden'
        )}
      >
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Admin</h2>
            <button
              onClick={onToggle}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
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
        </div>

        <nav className="flex-1 p-2 space-y-1">
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
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                {/* <span>{item.icon}</span> */}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
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
