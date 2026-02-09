// Utility functions for invitation acceptance
import { supabase } from '../lib/supabaseClient';

export interface InvitationValidationResult {
  invitation_id: number | null;
  email: string | null;
  organization_id: number | null;
  role: string | null;
  is_valid: boolean;
  error_message: string | null;
}

/**
 * Validates an invitation token (plain token, will be hashed in database)
 * Can be called by anyone (anon) to check if a token is valid
 */
export async function validateInvitationToken(
  token: string
): Promise<InvitationValidationResult> {
  try {
    const { data, error } = await supabase.rpc('validate_invitation_token', {
      token: token,
    });

    if (error) {
      console.error('Error validating invitation token:', error);
      return {
        invitation_id: null,
        email: null,
        organization_id: null,
        role: null,
        is_valid: false,
        error_message: error.message || 'Failed to validate invitation',
      };
    }

    if (!data || data.length === 0) {
      return {
        invitation_id: null,
        email: null,
        organization_id: null,
        role: null,
        is_valid: false,
        error_message: 'Invalid invitation token',
      };
    }

    const result = data[0];
    return {
      invitation_id: result.invitation_id,
      email: result.email,
      organization_id: result.organization_id,
      role: result.role,
      is_valid: result.is_valid,
      error_message: result.error_message,
    };
  } catch (error) {
    console.error('Unexpected error validating invitation:', error);
    return {
      invitation_id: null,
      email: null,
      organization_id: null,
      role: null,
      is_valid: false,
      error_message:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export interface AcceptInvitationResult {
  success: boolean;
  error_message: string | null;
}

/**
 * Finalizes invitation acceptance after user is created
 * Must be called after supabase.auth.signUp() succeeds
 * Accepts plain token (will be hashed in database)
 * Requires user_email to verify it matches the invitation email
 */
export async function acceptInvitation(
  token: string,
  userId: string,
  userEmail: string
): Promise<AcceptInvitationResult> {
  try {
    const { data, error } = await supabase.rpc('accept_invitation', {
      token: token,
      user_id: userId,
      user_email: userEmail,
    });

    if (error) {
      console.error('Error accepting invitation:', error);
      return {
        success: false,
        error_message: error.message || 'Failed to accept invitation',
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error_message: 'No data returned from accept_invitation',
      };
    }

    const result = data[0];
    return {
      success: result.success,
      error_message: result.error_message,
    };
  } catch (error) {
    console.error('Unexpected error accepting invitation:', error);
    return {
      success: false,
      error_message:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
