// Hook to fetch organizations
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
}

/**
 * Hook to fetch organizations the current user is a member of
 */
export function useOrganizations() {
  const { user } = useAuth();

  const {
    data: organizations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['organizations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get user's organization memberships
      const { data: memberships, error: membershipsError } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', user.id);

      if (membershipsError || !memberships) {
        console.error(
          'Error fetching organization memberships:',
          membershipsError
        );
        return [];
      }

      const orgIds = memberships.map((m) => m.organization_id);

      if (orgIds.length === 0) {
        return [];
      }

      // Fetch organizations
      const { data, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)
        .order('name', { ascending: true });

      if (orgsError) {
        console.error('Error fetching organizations:', orgsError);
        return [];
      }

      return (data || []) as Organization[];
    },
    enabled: !!user?.id,
  });

  return { organizations, isLoading, error };
}
