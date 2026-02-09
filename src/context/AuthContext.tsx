import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { Profile, OrgRole } from '../types/auth';
import { setSentryUser } from '../lib/sentry';

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  role: OrgRole | null; // Role from organization_memberships (2.3.1) - org-level only
  isSuperAdmin: boolean; // Global super admin flag from profiles
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<OrgRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- helpers -------------------------------------------------------

  async function fetchProfile(userId: string, userEmail?: string) {
    try {
      // Fetch profile (for full_name, etc.)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.warn('fetchProfile error', profileError.message);
        setProfile(null);
        setIsSuperAdmin(false);
      } else {
        const profile = profileData ? (profileData as Profile) : null;
        setProfile(profile);
        setIsSuperAdmin(profile?.is_super_admin ?? false);
      }

      // Fetch role from organization_memberships (2.3.1: roles per membership, not profile)
      // Get the first/default organization membership role
      const { data: membershipData, error: membershipError } = await supabase
        .from('organization_memberships')
        .select('role')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        console.warn('fetchMembershipRole error', membershipError.message);
        setRole(null);
      } else {
        const membershipRole = membershipData?.role as OrgRole | null;
        setRole(membershipRole ?? null);
      }

      // Update Sentry user context
      const currentRole = (membershipData?.role as OrgRole | null) ?? null;
      const profile = profileData ? (profileData as Profile) : null;
      const superAdmin = profile?.is_super_admin ?? false;

      setSentryUser({
        id: userId,
        email: userEmail,
        role: superAdmin ? 'super_admin' : currentRole || undefined,
        name: profile?.full_name || undefined,
      });
    } catch (err) {
      console.warn('fetchProfile unexpected error', err);
      setProfile(null);
      setRole(null);
      setIsSuperAdmin(false);
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
    isSuperAdmin,
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
