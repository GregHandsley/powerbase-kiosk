// src/pages/Login.tsx
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

export function Login() {
  const { signIn, loading } = useAuth();
  const { branding } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const ambientRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = ambientRef.current;
    if (!container) return;

    let animationFrame: number | null = null;

    const handleMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      animationFrame = requestAnimationFrame(() => {
        container.style.setProperty('--glow-x', `${x.toFixed(2)}%`);
        container.style.setProperty('--glow-y', `${y.toFixed(2)}%`);
      });
    };

    const handleLeave = () => {
      container.style.setProperty('--glow-x', '50%');
      container.style.setProperty('--glow-y', '50%');
    };

    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseleave', handleLeave);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setLoginError(error);
    }
    setLoginLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-300 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div
      ref={ambientRef}
      className="min-h-screen flex items-center justify-center bg-slate-950 p-4 login-ambient"
    >
      <div className="w-full max-w-sm glass-panel rounded-2xl p-6 space-y-4 relative z-10">
        <div>
          {branding?.logo_url && (
            <img
              src={branding.logo_url}
              alt="Organization logo"
              className="h-12 w-auto max-w-[200px] object-contain mb-4"
            />
          )}
          <h1 className="text-2xl font-semibold mb-2 text-slate-100">
            Powerbase Kiosk
          </h1>
          <p className="text-sm text-slate-300">
            Sign in with your account to continue.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-200">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-200">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {loginError && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md p-2">
              {loginError}
            </div>
          )}
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full mt-2 inline-flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium py-2.5 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loginLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
