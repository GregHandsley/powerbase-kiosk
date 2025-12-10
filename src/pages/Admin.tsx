import { useState } from "react";
import { BookingFormPanel } from "../components/admin/BookingFormPanel";
import { InstancesDebugPanel } from "../components/admin/InstancesDebugPanel";
import { Clock } from "../components/Clock";
import { useAuth } from "../context/AuthContext";

export function Admin() {
  const { user, profile, role, loading, signOut, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const showSpinner = (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
      <div className="text-slate-300 text-sm">Loading...</div>
    </div>
  );

  if (loading) return showSpinner;

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-xl space-y-3">
          <div>
            <h1 className="text-lg font-semibold mb-1 text-slate-100">
              Admin / Coach Login
            </h1>
            <p className="text-xs text-slate-300">
              Sign in with your Supabase account to access the admin tools.
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
              {loginLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
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
      </div>
    );
  }

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
