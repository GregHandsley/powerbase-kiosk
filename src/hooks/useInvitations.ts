// Hook for managing invitations
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export interface Invitation {
  id: number;
  email: string;
  organization_id: number;
  role: 'admin' | 'coach';
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  invited_by: string | null;
  organization_name?: string;
}

export interface CreateInvitationParams {
  email: string;
  organization_id: number;
  role: 'admin' | 'coach';
  expires_in_days?: number;
}

export interface CreateInvitationResult {
  invitation_id: number;
  token: string;
  error_message: string | null;
}

// Type for raw Supabase invitation data with organization join
type InvitationWithOrganization = {
  id: number;
  email: string;
  organization_id: number;
  role: 'admin' | 'coach';
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  invited_by: string | null;
  organization: { name: string } | { name: string }[] | null | undefined;
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

      // Fetch invitations for user's organizations
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
          )
        `
        )
        .in('organization_id', orgIds)
        .order('created_at', { ascending: false });

      if (invitationsError) {
        console.error('Error fetching invitations:', invitationsError);
        return [];
      }

      // Transform the data to include organization name
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
        return {
          ...inv,
          organization_name: orgName,
        } as Invitation;
      });
    },
    enabled: !!user?.id,
  });

  // Create invitation mutation
  const createInvitationMutation = useMutation({
    mutationFn: async (params: CreateInvitationParams) => {
      const { data, error } = await supabase.rpc('create_invitation', {
        p_email: params.email.toLowerCase().trim(),
        p_organization_id: params.organization_id,
        p_role: params.role,
        p_expires_in_days: params.expires_in_days || 7,
        p_invited_by: user?.id || null,
      });

      if (error) {
        // Check if function doesn't exist
        if (
          error.code === '42883' ||
          error.message?.includes('does not exist')
        ) {
          throw new Error(
            "Database function 'create_invitation' does not exist. Please run the migration: migrations/add_invitation_management_functions.sql"
          );
        }
        throw new Error(error.message || 'Failed to create invitation');
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from create_invitation');
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
