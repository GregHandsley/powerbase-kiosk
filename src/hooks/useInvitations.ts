// Hook for managing invitations
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

import type { OrgRole } from '../types/auth';

export interface Invitation {
  id: number;
  email: string;
  organization_id: number;
  role: OrgRole; // Organization-level role (no super_admin)
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  invited_by: string | null;
  organization_name?: string;
  site_ids?: number[]; // Sites assigned to this invitation
  site_names?: string[]; // Site names for display
}

export interface CreateInvitationParams {
  email: string;
  organization_id: number;
  role: OrgRole; // Organization-level role (no super_admin)
  expires_in_days?: number;
  site_ids?: number[]; // Optional: sites to grant access to
}

export interface CreateInvitationResult {
  invitation_id: number;
  token: string;
  error_message: string | null;
}

// Type for raw Supabase invitation data with organization and sites join
// Note: Supabase PostgREST can return nested relations as single objects or arrays
type InvitationWithOrganization = {
  id: number;
  email: string;
  organization_id: number;
  role: OrgRole;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  invited_by: string | null;
  organization: { name: string } | { name: string }[] | null | undefined;
  invitation_sites:
    | Array<{
        site_id: number;
        site:
          | { id: number; name: string }
          | { id: number; name: string }[]
          | null;
      }>
    | null
    | undefined;
};

/**
 * Hook to fetch invitations for the current user's organization(s)
 */
export function useInvitations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch invitations
  const {
    data: invitations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invitations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get user's organization memberships to filter invitations
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

      // Fetch invitations for user's organizations (with sites)
      const { data, error: invitationsError } = await supabase
        .from('invitations')
        .select(
          `
          id,
          email,
          organization_id,
          role,
          expires_at,
          accepted_at,
          revoked_at,
          created_at,
          invited_by,
          organization:organizations (
            name
          ),
          invitation_sites:invitation_sites (
            site_id,
            site:sites (
              id,
              name
            )
          )
        `
        )
        .in('organization_id', orgIds)
        .order('created_at', { ascending: false });

      if (invitationsError) {
        console.error('Error fetching invitations:', invitationsError);
        return [];
      }

      // Transform the data to include organization name and sites
      return (data || []).map((inv: InvitationWithOrganization) => {
        let orgName: string | null = null;
        const org = inv.organization;
        if (org) {
          if (Array.isArray(org) && org.length > 0) {
            orgName = org[0]?.name || null;
          } else if (!Array.isArray(org)) {
            orgName = org.name || null;
          }
        }

        // Extract site IDs and names
        const siteIds: number[] = [];
        const siteNames: string[] = [];
        if (inv.invitation_sites && Array.isArray(inv.invitation_sites)) {
          inv.invitation_sites.forEach((is) => {
            // Handle both single object and array formats from Supabase
            const site = is.site;
            if (site) {
              if (Array.isArray(site)) {
                // If site is an array, take the first one
                const firstSite = site[0];
                if (firstSite?.id) {
                  siteIds.push(firstSite.id);
                  if (firstSite.name) {
                    siteNames.push(firstSite.name);
                  }
                }
              } else {
                // If site is a single object
                if (site.id) {
                  siteIds.push(site.id);
                  if (site.name) {
                    siteNames.push(site.name);
                  }
                }
              }
            }
          });
        }

        return {
          ...inv,
          organization_name: orgName,
          site_ids: siteIds.length > 0 ? siteIds : undefined,
          site_names: siteNames.length > 0 ? siteNames : undefined,
        } as Invitation;
      });
    },
    enabled: !!user?.id,
  });

  // Create invitation mutation (with site support)
  const createInvitationMutation = useMutation({
    mutationFn: async (params: CreateInvitationParams) => {
      // Use create_invitation_with_sites if site_ids are provided, otherwise use create_invitation
      const hasSites = params.site_ids && params.site_ids.length > 0;
      const functionName = hasSites
        ? 'create_invitation_with_sites'
        : 'create_invitation';

      const rpcParams: Record<string, unknown> = {
        p_email: params.email.toLowerCase().trim(),
        p_organization_id: params.organization_id,
        p_role: params.role,
        p_expires_in_days: params.expires_in_days || 7,
      };

      // Only include p_invited_by if user is available (let default handle it otherwise)
      if (user?.id) {
        rpcParams.p_invited_by = user.id;
      }

      // Always pass p_site_ids when using create_invitation_with_sites
      // Even if empty, Supabase RPC may require it to be passed explicitly
      if (functionName === 'create_invitation_with_sites') {
        // Ensure we pass an array, not undefined
        rpcParams.p_site_ids = params.site_ids ?? [];
      }

      const { data, error } = await supabase.rpc(functionName, rpcParams);

      if (error) {
        console.error(`Error calling ${functionName}:`, error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.error('Parameters:', rpcParams);

        // Check if function doesn't exist
        if (
          error.code === '42883' ||
          error.message?.includes('does not exist') ||
          error.details?.includes('does not exist')
        ) {
          throw new Error(
            `Database function '${functionName}' does not exist. Please run the migration: migrations/add_invitation_sites_and_function.sql`
          );
        }

        // Provide more detailed error message
        const errorMessage =
          error.message ||
          error.details ||
          error.hint ||
          'Failed to create invitation';
        throw new Error(`${errorMessage} (Function: ${functionName})`);
      }

      if (!data || data.length === 0) {
        throw new Error(`No data returned from ${functionName}`);
      }

      const result = data[0];
      if (result.error_message) {
        throw new Error(result.error_message);
      }

      return result as CreateInvitationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', user?.id] });
    },
  });

  // Resend invitation mutation (rotate token)
  const resendInvitationMutation = useMutation({
    mutationFn: async ({
      invitation_id,
      expires_in_days = 7,
    }: {
      invitation_id: number;
      expires_in_days?: number;
    }) => {
      const { data, error } = await supabase.rpc('resend_invitation', {
        p_invitation_id: invitation_id,
        p_expires_in_days: expires_in_days,
      });

      if (error) {
        // Check if function doesn't exist
        if (
          error.code === '42883' ||
          error.message?.includes('does not exist')
        ) {
          throw new Error(
            "Database function 'resend_invitation' does not exist. Please run the migration: migrations/add_invitation_management_functions.sql"
          );
        }
        throw new Error(error.message || 'Failed to resend invitation');
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from resend_invitation');
      }

      const result = data[0];
      if (!result.success) {
        throw new Error(result.error_message || 'Failed to resend invitation');
      }

      return result.token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', user?.id] });
    },
  });

  // Revoke invitation mutation
  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitation_id: number) => {
      const { data, error } = await supabase.rpc('revoke_invitation', {
        p_invitation_id: invitation_id,
      });

      if (error) {
        // Check if function doesn't exist
        if (
          error.code === '42883' ||
          error.message?.includes('does not exist')
        ) {
          throw new Error(
            "Database function 'revoke_invitation' does not exist. Please run the migration: migrations/add_invitation_management_functions.sql"
          );
        }
        throw new Error(error.message || 'Failed to revoke invitation');
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from revoke_invitation');
      }

      const result = data[0];
      if (!result.success) {
        throw new Error(result.error_message || 'Failed to revoke invitation');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', user?.id] });
    },
  });

  return {
    invitations,
    isLoading,
    error,
    createInvitation: createInvitationMutation.mutateAsync,
    createInvitationLoading: createInvitationMutation.isPending,
    resendInvitation: resendInvitationMutation.mutateAsync,
    resendInvitationLoading: resendInvitationMutation.isPending,
    revokeInvitation: revokeInvitationMutation.mutateAsync,
    revokeInvitationLoading: revokeInvitationMutation.isPending,
  };
}
