import { useState } from "react";
import type { FormEvent } from "react";
import { AspectRatio } from "../components/AspectRatio";
import { Clock } from "../components/Clock";
import { useAuth } from "../context/AuthContext";

export function Admin() {
  const { user, profile, role, loading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setErrorMsg(error);
    }
    setSubmitting(false);
  }

  const showSpinner = (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
      <div className="text-slate-300 text-sm">Loading...</div>
    </div>
  );

  if (loading) {
    return showSpinner;
  }

  // Not logged in → show login form
  if (!user) {
    return (
      <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-xl">
          <h1 className="text-lg font-semibold mb-2">Admin / Coach Login</h1>
          <p className="text-xs text-slate-300 mb-4">
            Sign in with your Supabase account. Your role is determined by your
            profile in the database.
          </p>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Email</label>
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
              <label className="block text-xs font-medium mb-1">Password</label>
              <input
                type="password"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {errorMsg && (
              <p className="text-xs text-red-400">{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 inline-flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium py-1.5 disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Logged in but no recognised role
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

  // Logged in with valid role: show basic dashboard shell
  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          <p className="text-slate-300 text-sm">
            Signed in as{" "}
            <span className="font-mono">{user.email ?? "unknown"}</span>{" "}
            ({role}){profile?.full_name ? ` – ${profile.full_name}` : ""}
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

      <section className="grid gap-4 md:grid-cols-3">
        <button className="rounded-xl bg-slate-900 border border-slate-700 p-4 text-left hover:border-indigo-500 transition">
          <h2 className="text-sm font-semibold mb-1">Create Booking</h2>
          <p className="text-xs text-slate-300">
            Define squads, time windows, recurrence and allocate racks/areas.
          </p>
        </button>

        <button className="rounded-xl bg-slate-900 border border-slate-700 p-4 text-left hover:border-indigo-500 transition">
          <h2 className="text-sm font-semibold mb-1">Rack Allocation</h2>
          <p className="text-xs text-slate-300">
            Drag squads across platforms and adjust their footprint.
          </p>
        </button>

        <button className="rounded-xl bg-slate-900 border border-slate-700 p-4 text-left hover:border-indigo-500 transition">
          <h2 className="text-sm font-semibold mb-1">Instances Debug</h2>
          <p className="text-xs text-slate-300">
            Inspect materialised booking instances used by kiosk views.
          </p>
        </button>
      </section>

      <section>
        <AspectRatio ratio={16 / 9}>
          <div className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-center">
            <span className="text-slate-400 text-sm">
              Placeholder admin panel. In later sprints this becomes the live booking
              and rack editor.
            </span>
          </div>
        </AspectRatio>
      </section>
    </div>
  );
}
