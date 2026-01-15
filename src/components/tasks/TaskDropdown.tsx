import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useTasks } from '../../hooks/useTasks';
import type { Task } from '../../hooks/useTasks';

function TaskItem({ task, onClose }: { task: Task; onClose: () => void }) {
  const navigate = useNavigate();
  const isRead = !!task.read_at;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Get booking ID from task metadata or link
    const bookingId =
      task.metadata?.booking_id || task.link?.match(/booking=(\d+)/)?.[1];

    if (bookingId) {
      // Navigate to bookings team page with booking query parameter
      navigate(`/bookings-team?booking=${String(bookingId)}`);
      onClose();
    } else if (task.link) {
      // Fallback to original link if no booking ID found
      navigate(task.link);
      onClose();
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'last_minute_change':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
            <svg
              className="h-4 w-4 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        );
      case 'booking:created':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
            <svg
              className="h-4 w-4 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
        );
      case 'booking:processed':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
            <svg
              className="h-4 w-4 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case 'booking:cancelled':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
            <svg
              className="h-4 w-4 text-red-400"
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
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500/20">
            <svg
              className="h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
        );
    }
  };

  return (
    <div
      className={`flex gap-3 p-3 hover:bg-slate-800/50 transition-colors cursor-pointer ${
        !isRead ? 'bg-slate-800/30' : ''
      }`}
      onClick={handleClick}
    >
      {getTaskIcon(task.type)}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${!isRead ? 'font-semibold text-white' : 'text-slate-300'}`}
        >
          {task.title}
        </p>
        {task.message && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
            {task.message}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

type TaskDropdownProps = {
  onClose: () => void;
};

export function TaskDropdown({ onClose }: TaskDropdownProps) {
  const { tasks, isLoading } = useTasks();

  if (isLoading) {
    return (
      <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
        <div className="p-4 text-center text-slate-400 text-sm">
          Loading tasks...
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-[500px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200">Tasks</h3>
      </div>

      {/* Tasks List */}
      <div className="overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <svg
              className="w-12 h-12 mx-auto mb-2 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <p>No tasks</p>
            <p className="text-xs mt-1">All caught up!</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskItem key={task.id} task={task} onClose={onClose} />
          ))
        )}
      </div>

      {/* Footer */}
      {tasks.length > 0 && (
        <div className="p-3 border-t border-slate-700">
          <Link
            to="/bookings-team"
            className="block text-center text-xs text-slate-400 hover:text-slate-300 transition-colors"
            onClick={onClose}
          >
            View all tasks
          </Link>
        </div>
      )}
    </div>
  );
}
