// Hook to fetch sites for an organization
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export interface Site {
  id: number;
  organization_id: number;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
}

/**
 * Hook to fetch sites for a specific organization
 */
export function useSites(organizationId: number | null) {
  const {
    data: sites = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sites', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error: sitesError } = await supabase
        .from('sites')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (sitesError) {
        console.error('Error fetching sites:', sitesError);
        return [];
      }

      return (data || []) as Site[];
    },
    enabled: !!organizationId,
  });

  return { sites, isLoading, error };
}
