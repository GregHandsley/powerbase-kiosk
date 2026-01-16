// Hook for checking user permissions
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

/**
 * Hook to check if the current user has a specific permission in an organization
 * @param organizationId - The organization ID to check permissions for
 * @param permissionKey - The permission key (e.g., 'bookings.create', 'invitations.create')
 * @returns Object with hasPermission boolean and isLoading state
 */
export function usePermission(
  organizationId: number | null,
  permissionKey: string
) {
  const { user, isSuperAdmin } = useAuth();

  const {
    data: hasPermission = false,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['permission', user?.id, organizationId, permissionKey],
    queryFn: async () => {
      // Super admins have all permissions
      if (isSuperAdmin) {
        return true;
      }

      if (!user?.id || !organizationId) {
        return false;
      }

      const { data, error: rpcError } = await supabase.rpc('has_permission', {
        p_user_id: user.id,
        p_organization_id: organizationId,
        p_permission_key: permissionKey,
      });

      if (rpcError) {
        console.error(
          `Error checking permission ${permissionKey}:`,
          rpcError.message
        );
        return false;
      }

      return data === true;
    },
    enabled: !!user?.id && organizationId !== null,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (permissions don't change often)
  });

  return { hasPermission, isLoading, error };
}

/**
 * Hook to get the user's primary organization ID (first organization they're a member of)
 * Useful for components that need to check permissions but don't have a specific organization context
 */
export function usePrimaryOrganizationId() {
  const { user } = useAuth();

  const {
    data: organizationId = null,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['primary-organization', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: memberships, error: membershipsError } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membershipsError || !memberships) {
        console.error('Error fetching primary organization:', membershipsError);
        return null;
      }

      return memberships.organization_id as number | null;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  return { organizationId, isLoading, error };
}
