import { BookingFormPanel } from "../components/admin/BookingFormPanel";
import { InstancesDebugPanel } from "../components/admin/InstancesDebugPanel";
import { Clock } from "../components/Clock";
import { useAuth } from "../context/AuthContext";

export function Admin() {
  const { user, profile, role, loading, signOut } = useAuth();

  const showSpinner = (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
      <div className="text-slate-300 text-sm">Loading...</div>
    </div>
  );

  if (loading) {
    return showSpinner;
  }

  // Not logged in → show the login screen (from previous sprint)
  if (!user) {
    // We keep the login logic in a separate component if you prefer,
    // but since you already had this in Sprint 2, you can either
    // keep that file or reuse it here.
    // For brevity, we’ll just say: keep your existing "not logged in" branch.
    return (
      <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
        <div className="text-slate-300 text-sm">
          You are not logged in. Please use the login form implemented in Sprint 2.
        </div>
      </div>
    );
  }

  if (!role || (role !== "admin" && role !== "coach")) {
    return (
      <div className="p-4 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Admin Dashboard</h1>
            <p className="text-slate-300 text-sm">
              You are signed in as <span className="font-mono">{user.email}</span>,
              but your profile does not grant admin / coach access.
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

        <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-4">
          <p className="text-sm text-amber-100">
            Your <code>profiles</code> row is missing or has an unexpected role.  
            Ask an admin to set your role to <code>admin</code> or{" "}
            <code>coach</code> in the database.
          </p>
        </div>
      </div>
    );
  }

  // Logged in with valid role
  const displayName = profile?.full_name || user.email || "Unknown";

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          <p className="text-slate-300 text-sm">
            Signed in as{" "}
            <span className="font-mono">{user.email ?? "unknown"}</span>{" "}
            ({role}) – {displayName}
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

      <BookingFormPanel role={role} />
      <InstancesDebugPanel />
    </div>
  );
}
