import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { Profile, ProfileRole } from '../types/auth';
import { setSentryUser } from '../lib/sentry';

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  role: ProfileRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const role: ProfileRole | null = profile?.role ?? null;

  // --- helpers -------------------------------------------------------

  async function fetchProfile(userId: string, userEmail?: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('fetchProfile error', error.message);
        setProfile(null);
        return;
      }

      const profileData = data ? (data as Profile) : null;
      setProfile(profileData);

      // Update Sentry user context with full profile info
      if (profileData) {
        setSentryUser({
          id: userId,
          email: userEmail,
          role: profileData.role,
          name: profileData.full_name || undefined,
        });
      }
    } catch (err) {
      console.warn('fetchProfile unexpected error', err);
      setProfile(null);
    }
  }

  // --- initial load + auth subscription -----------------------------

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSession() {
      try {
        setLoading(true);
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error) {
          // Only log auth errors if we're not on the login page (expected errors)
          if (window.location.pathname !== '/login') {
            console.warn('getUser error', error.message);
          }
          setUser(null);
          setProfile(null);
          return;
        }

        setUser(user ?? null);

        if (user) {
          // Set Sentry user context immediately with basic info
          setSentryUser({
            id: user.id,
            email: user.email,
          });
          void fetchProfile(user.id, user.email); // don't block UI on profile fetch
        } else {
          setProfile(null);
          setSentryUser(null); // Clear Sentry user context
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const u = session?.user ?? null;
        setUser(u);

        if (u) {
          // Set Sentry user context immediately with basic info
          setSentryUser({
            id: u.id,
            email: u.email,
          });
          void fetchProfile(u.id, u.email); // fire and forget to avoid blocking loading state
        } else {
          setProfile(null);
          setSentryUser(null); // Clear Sentry user context
        }
      } catch (err) {
        // Only log auth errors if we're not on the login page (expected errors)
        if (window.location.pathname !== '/login') {
          console.warn('onAuthStateChange error', err);
        }
      } finally {
        // auth change completed → ensure we are not stuck loading
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- public API ----------------------------------------------------

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      setLoading(true);
      await fetchProfile(user.id, user.email);
    } finally {
      setLoading(false);
    }
  };

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.warn('signIn error', error.message);
        return { error: error.message };
      }

      // onAuthStateChange will set user/profile
      return {};
    } finally {
      // We immediately clear loading; if you want a slight delay until
      // onAuthStateChange finishes, you could keep it true, but this
      // avoids the "stuck loading" issue.
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('signOut error', error.message);
      }
      setUser(null);
      setProfile(null);
      setSentryUser(null); // Clear Sentry user context on sign out
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextValue = {
    user,
    profile,
    role,
    loading,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
