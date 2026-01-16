import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { getRoleDisplayName } from '../types/auth';
import { formatDateBritishShort } from '../components/shared/dateUtils';
import { format, parseISO } from 'date-fns';
import { ConfirmationDialog } from '../components/shared/ConfirmationDialog';
import type { OrgRole } from '../types/auth';
import type { Organization } from '../hooks/useOrganizations';
import type { Site } from '../hooks/useSites';

interface OrganizationMembershipWithOrg {
  id: number;
  organization_id: number;
  role: OrgRole;
  created_at: string;
  organization: Organization;
}

interface SiteMembershipWithSite {
  site_id: number;
  user_id: string;
  created_at: string;
  site: Site & { organization?: { id: number; name: string } };
}

export function Profile() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(profile?.full_name || '');
  const [isSavingName, setIsSavingName] = useState(false);

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Email change state
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Account deletion state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch organization memberships with organization details
  const { data: orgMemberships = [], isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['profile-org-memberships', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('organization_memberships')
        .select(
          `
          id,
          organization_id,
          role,
          created_at,
          organization:organizations (
            id,
            name,
            slug,
            settings,
            created_at
          )
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching organization memberships:', error);
        return [];
      }

      // Transform the data structure
      return (data || []).map((m) => {
        const org = Array.isArray(m.organization)
          ? m.organization[0]
          : m.organization;
        return {
          id: m.id,
          organization_id: m.organization_id,
          role: m.role as OrgRole,
          created_at: m.created_at,
          organization: org as Organization,
        };
      }) as OrganizationMembershipWithOrg[];
    },
    enabled: !!user?.id,
  });

  // Fetch site memberships with site details
  const { data: siteMemberships = [], isLoading: isLoadingSites } = useQuery({
    queryKey: ['profile-site-memberships', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('site_memberships')
        .select(
          `
          site_id,
          user_id,
          created_at,
          site:sites (
            id,
            organization_id,
            name,
            slug,
            settings,
            created_at,
            organization:organizations (
              id,
              name
            )
          )
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching site memberships:', error);
        return [];
      }

      // Transform the data structure
      return (data || []).map((m) => {
        const site = Array.isArray(m.site) ? m.site[0] : m.site;
        const org = site?.organization
          ? Array.isArray(site.organization)
            ? site.organization[0]
            : site.organization
          : undefined;
        return {
          site_id: m.site_id,
          user_id: m.user_id,
          created_at: m.created_at,
          site: {
            ...site,
            organization: org,
          } as Site & { organization?: { id: number; name: string } },
        };
      }) as SiteMembershipWithSite[];
    },
    enabled: !!user?.id,
  });

  const handleSaveName = async () => {
    if (!user?.id || !editedName.trim()) return;

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editedName.trim() })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating name:', error);
        toast.error('Failed to update name. Please try again.');
        return;
      }

      // Refresh profile in auth context
      await refreshProfile();
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['profile-org-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['profile-site-memberships'] });
      setIsEditingName(false);
      toast.success('Name updated successfully');
    } catch (err) {
      console.error('Unexpected error updating name:', err);
      toast.error('Failed to update name. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(profile?.full_name || '');
    setIsEditingName(false);
  };

  const handleChangePassword = async () => {
    if (!user?.email || !currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsSavingPassword(true);
    setPasswordError(null);

    try {
      // First, verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        setPasswordError('Current password is incorrect');
        setIsSavingPassword(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message || 'Failed to update password');
        setIsSavingPassword(false);
        return;
      }

      // Success - reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
      setPasswordError(null);
      toast.success('Password updated successfully');
    } catch (err) {
      console.error('Unexpected error changing password:', err);
      setPasswordError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsChangingPassword(false);
    setPasswordError(null);
  };

  const handleChangeEmail = async () => {
    if (!user?.email || !currentPasswordForEmail || !newEmail) {
      setEmailError('All fields are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (newEmail.toLowerCase() === user.email?.toLowerCase()) {
      setEmailError('New email must be different from current email');
      return;
    }

    setIsSavingEmail(true);
    setEmailError(null);

    try {
      // First, verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPasswordForEmail,
      });

      if (verifyError) {
        setEmailError('Current password is incorrect');
        setIsSavingEmail(false);
        return;
      }

      // Update email (Supabase will send a verification email)
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail.toLowerCase().trim(),
      });

      if (updateError) {
        setEmailError(updateError.message || 'Failed to update email');
        setIsSavingEmail(false);
        return;
      }

      // Success - reset form
      setCurrentPasswordForEmail('');
      setNewEmail('');
      setIsChangingEmail(false);
      setEmailError(null);
      toast.success(
        'Email update request sent. Please check your new email for a verification link. You will need to verify the new email before it becomes active.',
        { duration: 6000 }
      );

      // Refresh profile to get updated email
      await refreshProfile();
    } catch (err) {
      console.error('Unexpected error changing email:', err);
      setEmailError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleCancelEmailChange = () => {
    setCurrentPasswordForEmail('');
    setNewEmail('');
    setIsChangingEmail(false);
    setEmailError(null);
  };

  const handleRequestDeleteAccount = () => {
    setShowDeleteConfirmation(true);
    setDeletePassword('');
    setDeleteError(null);
  };

  const handleConfirmDeleteAccount = async () => {
    if (!user?.email || !deletePassword) {
      setDeleteError('Password is required');
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      // First, verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });

      if (verifyError) {
        setDeleteError('Password is incorrect');
        setIsDeletingAccount(false);
        return;
      }

      // Call Edge Function to delete account (handles both auth user and app data)
      // The Edge Function:
      // 1. Verifies password
      // 2. Calls delete_user_account RPC to anonymize app data
      // 3. Deletes/bans the auth user to prevent login
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        setDeleteError('Configuration error. Please contact support.');
        setIsDeletingAccount(false);
        return;
      }

      // Get user and session token for Edge Function authentication
      // Use getUser() to get a fresh token (more reliable than getSession())
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        setDeleteError('Session expired. Please sign in again.');
        setIsDeletingAccount(false);
        return;
      }

      // Get the session to access the access_token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setDeleteError('Session expired. Please sign in again.');
        setIsDeletingAccount(false);
        return;
      }

      const { data: result, error: functionError } =
        await supabase.functions.invoke('delete-user-account', {
          body: {
            password: deletePassword,
          },
        });

      if (functionError) {
        console.error('Edge Function error:', functionError);
        let functionErrorMessage =
          functionError.message || 'Failed to delete account';

        const contextBody = (functionError as { context?: { body?: unknown } })
          .context?.body;
        if (contextBody) {
          try {
            const parsedBody =
              typeof contextBody === 'string'
                ? JSON.parse(contextBody)
                : contextBody;
            if (
              parsedBody &&
              typeof parsedBody === 'object' &&
              'error' in parsedBody &&
              typeof parsedBody.error === 'string'
            ) {
              functionErrorMessage = parsedBody.error;
            } else if (
              parsedBody &&
              typeof parsedBody === 'object' &&
              'message' in parsedBody &&
              typeof parsedBody.message === 'string'
            ) {
              functionErrorMessage = parsedBody.message;
            }
          } catch (parseError) {
            console.error(
              'Error parsing edge function error body:',
              parseError
            );
          }
        }

        setDeleteError(functionErrorMessage);
        setIsDeletingAccount(false);
        return;
      }

      if (result?.success === false) {
        setDeleteError(result.error || 'Failed to delete account');
        setIsDeletingAccount(false);
        return;
      }

      // Success - sign out and redirect to login
      toast.success('Your account has been deleted successfully');
      setShowDeleteConfirmation(false);

      // Wait a moment for toast to show, then sign out
      setTimeout(async () => {
        await signOut();
        navigate('/login');
      }, 1500);
    } catch (err) {
      console.error('Unexpected error deleting account:', err);
      setDeleteError('An unexpected error occurred. Please try again.');
      setIsDeletingAccount(false);
    }
  };

  const handleCancelDeleteAccount = () => {
    setShowDeleteConfirmation(false);
    setDeletePassword('');
    setDeleteError(null);
  };

  if (!user || !profile) {
    return (
      <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
        <div className="text-slate-300 text-sm">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-slate-950 text-slate-200 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Profile</h1>

        {/* Profile Basics Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Profile Information</h2>

          <div className="space-y-4">
            {/* Email (editable with password verification) */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Email
              </label>
              {isChangingEmail ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPasswordForEmail}
                      onChange={(e) =>
                        setCurrentPasswordForEmail(e.target.value)
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter your current password"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      New Email
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter your new email"
                    />
                  </div>
                  {emailError && (
                    <div className="px-3 py-2 bg-red-900/20 border border-red-700/50 rounded-md text-red-300 text-sm">
                      {emailError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleChangeEmail}
                      disabled={isSavingEmail}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingEmail ? 'Updating...' : 'Update Email'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEmailChange}
                      disabled={isSavingEmail}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    A verification email will be sent to your new email address.
                    You must verify it before the change takes effect.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-slate-300">
                    {user.email}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChangingEmail(true)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
                  >
                    Change Email
                  </button>
                </div>
              )}
            </div>

            {/* Full Name (editable) */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Full Name
              </label>
              {isEditingName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter your full name"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingName ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSavingName}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-slate-300">
                    {profile.full_name || 'Not set'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditedName(profile.full_name || '');
                      setIsEditingName(true);
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Account Created Date */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Account Created
              </label>
              <div className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-slate-300">
                {formatDateBritishShort(profile.created_at)} at{' '}
                {format(parseISO(profile.created_at), 'HH:mm')}
              </div>
            </div>

            {/* Super Admin Badge */}
            {profile.is_super_admin && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Admin Status
                </label>
                <div className="inline-block px-3 py-1.5 bg-purple-900/30 text-purple-300 rounded-md border border-purple-700/50 font-medium">
                  Super Admin
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Organization Memberships Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Organisation Memberships
          </h2>

          {isLoadingOrgs ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : orgMemberships.length === 0 ? (
            <div className="text-slate-400 text-sm">
              No organisation memberships found
            </div>
          ) : (
            <div className="space-y-3">
              {orgMemberships.map((membership) => (
                <div
                  key={membership.id}
                  className="bg-slate-900/50 border border-slate-700 rounded-md p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white">
                          {membership.organization.name}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium bg-indigo-900/40 text-indigo-200 rounded border border-indigo-700/50">
                          {getRoleDisplayName(membership.role)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">
                        Member since:{' '}
                        <span className="text-slate-300">
                          {formatDateBritishShort(membership.created_at)} at{' '}
                          {format(parseISO(membership.created_at), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Password Change Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Change Password</h2>

          {isChangingPassword ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your current password"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your new password"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Password must be at least 6 characters
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Confirm your new password"
                />
              </div>
              {passwordError && (
                <div className="px-3 py-2 bg-red-900/20 border border-red-700/50 rounded-md text-red-300 text-sm">
                  {passwordError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={isSavingPassword}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingPassword ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelPasswordChange}
                  disabled={isSavingPassword}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setIsChangingPassword(true)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
              >
                Change Password
              </button>
            </div>
          )}
        </div>

        {/* Site Memberships Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Site Memberships</h2>

          {isLoadingSites ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : siteMemberships.length === 0 ? (
            <div className="text-slate-400 text-sm">
              No site memberships found
            </div>
          ) : (
            <div className="space-y-3">
              {siteMemberships.map((membership) => (
                <div
                  key={`${membership.site_id}-${membership.user_id}`}
                  className="bg-slate-900/50 border border-slate-700 rounded-md p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white">
                          {membership.site.name}
                        </h3>
                        {membership.site.organization && (
                          <span className="px-2 py-1 text-xs font-medium bg-slate-700/60 text-slate-300 rounded border border-slate-600/50">
                            {membership.site.organization.name}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-400">
                        Member since:{' '}
                        <span className="text-slate-300">
                          {formatDateBritishShort(membership.created_at)} at{' '}
                          {format(parseISO(membership.created_at), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account Deletion Section */}
        <div className="bg-red-900/10 border border-red-700/50 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-2 text-red-300">
            Danger Zone
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Permanently delete your account. This action cannot be undone.
          </p>

          <div className="bg-slate-900/50 border border-slate-700 rounded-md p-4 mb-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">
              What will happen:
            </h3>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Your account will be soft-deleted and marked as inactive</li>
              <li>
                Your personal information (name, email) will be anonymised
              </li>
              <li>
                Your bookings and audit history will be preserved but anonymised
              </li>
              <li>You will be signed out immediately</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleRequestDeleteAccount}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors font-medium"
          >
            Delete My Account
          </button>
        </div>
      </div>

      {/* Account Deletion Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteConfirmation}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action cannot be undone."
        confirmLabel="Delete Account"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={isDeletingAccount}
        onConfirm={handleConfirmDeleteAccount}
        onCancel={handleCancelDeleteAccount}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Enter your password to confirm
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter your password"
              autoFocus
              disabled={isDeletingAccount}
            />
          </div>
          {deleteError && (
            <div className="px-3 py-2 bg-red-900/20 border border-red-700/50 rounded-md text-red-300 text-sm">
              {deleteError}
            </div>
          )}
          <div className="text-xs text-slate-400 bg-yellow-900/20 border border-yellow-700/50 rounded-md p-3">
            <strong className="text-yellow-300">Warning:</strong> This will
            permanently anonymise your personal information. Your bookings and
            audit history will be preserved but your identity will be removed
            from all records.
          </div>
        </div>
      </ConfirmationDialog>
    </div>
  );
}
