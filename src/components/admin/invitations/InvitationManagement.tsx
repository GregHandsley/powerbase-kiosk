import { useState, useMemo } from 'react';
import { useInvitations } from '../../../hooks/useInvitations';
import { useOrganizations } from '../../../hooks/useOrganizations';
import { useSites } from '../../../hooks/useSites';
import {
  usePermission,
  usePrimaryOrganizationId,
} from '../../../hooks/usePermissions';
import toast from 'react-hot-toast';
import { format, parseISO, isAfter } from 'date-fns';
import { ConfirmationDialog } from '../../shared/ConfirmationDialog';
import type { OrgRole } from '../../../types/auth';
import { getRoleDisplayName } from '../../../types/auth';

type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

function getInvitationStatus(invitation: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): InvitationStatus {
  if (invitation.accepted_at) return 'accepted';
  if (invitation.revoked_at) return 'revoked';
  if (!isAfter(parseISO(invitation.expires_at), new Date())) return 'expired';
  return 'pending';
}

function StatusBadge({ status }: { status: InvitationStatus }) {
  const colors = {
    pending: 'bg-blue-900/30 text-blue-300 border-blue-700/50',
    accepted: 'bg-green-900/30 text-green-300 border-green-700/50',
    revoked: 'bg-red-900/30 text-red-300 border-red-700/50',
    expired: 'bg-slate-700/30 text-slate-400 border-slate-600/50',
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded border ${colors[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/**
 * Component to render action buttons for an invitation with permission checks
 */
function InvitationActions({
  invitation,
  isPending,
  onResend,
  onRevoke,
  resendLoading,
  revokeLoading,
}: {
  invitation: { id: number; organization_id: number };
  isPending: boolean;
  onResend: () => void;
  onRevoke: () => void;
  resendLoading: boolean;
  revokeLoading: boolean;
}) {
  const { hasPermission: canResend } = usePermission(
    invitation.organization_id,
    'invitations.resend'
  );
  const { hasPermission: canRevoke } = usePermission(
    invitation.organization_id,
    'invitations.revoke'
  );

  if (!isPending) {
    return null;
  }

  return (
    <>
      {canResend && (
        <button
          onClick={onResend}
          disabled={resendLoading}
          className="px-2 py-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline disabled:opacity-50"
          title="Resend invitation (rotate token)"
        >
          Resend
        </button>
      )}
      {canRevoke && (
        <button
          onClick={onRevoke}
          disabled={revokeLoading}
          className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:underline disabled:opacity-50"
          title="Revoke invitation"
        >
          Revoke
        </button>
      )}
      {!canResend && !canRevoke && (
        <span className="text-xs text-slate-500 italic">No permissions</span>
      )}
    </>
  );
}

export function InvitationManagement() {
  const {
    invitations,
    isLoading,
    createInvitation,
    createInvitationLoading,
    resendInvitation,
    resendInvitationLoading,
    revokeInvitation,
    revokeInvitationLoading,
  } = useInvitations();

  const { organizations, isLoading: orgsLoading } = useOrganizations();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formOrganizationId, setFormOrganizationId] = useState<number | ''>('');
  const [formRole, setFormRole] = useState<OrgRole>('snc_coach');
  const [formExpiresInDays, setFormExpiresInDays] = useState(7);
  const [formSiteIds, setFormSiteIds] = useState<number[]>([]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [revokingInvitationId, setRevokingInvitationId] = useState<
    number | null
  >(null);
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | 'all'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch sites for the selected organization
  const { sites, isLoading: sitesLoading } = useSites(
    formOrganizationId ? (formOrganizationId as number) : null
  );

  // Check permissions for creating invitations (for the selected organization)
  const { hasPermission: canCreate } = usePermission(
    formOrganizationId ? (formOrganizationId as number) : null,
    'invitations.create'
  );

  // Check permissions for the primary organization (fallback for create button visibility)
  const { organizationId: primaryOrgId } = usePrimaryOrganizationId();
  const { hasPermission: canCreatePrimary } = usePermission(
    primaryOrgId,
    'invitations.create'
  );

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formEmail || !formOrganizationId) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const result = await createInvitation({
        email: formEmail,
        organization_id: formOrganizationId as number,
        role: formRole,
        expires_in_days: formExpiresInDays,
        site_ids: formSiteIds.length > 0 ? formSiteIds : undefined,
      });

      toast.success('Invitation created successfully!');
      setCreatedToken(result.token);
      setFormEmail('');
      setFormOrganizationId('');
      setFormRole('snc_coach');
      setFormExpiresInDays(7);
      setFormSiteIds([]);
      setShowCreateForm(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create invitation'
      );
    }
  };

  const handleResend = async (invitationId: number) => {
    try {
      const token = await resendInvitation({
        invitation_id: invitationId,
        expires_in_days: 7,
      });
      toast.success('Invitation resent! New token generated.');
      setCreatedToken(token);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to resend invitation'
      );
    }
  };

  const handleRevoke = async (invitationId: number) => {
    setRevokingInvitationId(invitationId);
  };

  const confirmRevoke = async () => {
    if (!revokingInvitationId) return;

    try {
      await revokeInvitation(revokingInvitationId);
      toast.success('Invitation revoked');
      setRevokingInvitationId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to revoke invitation'
      );
    }
  };

  // Filter and search invitations
  const filteredInvitations = useMemo(() => {
    return invitations.filter((invitation) => {
      const status = getInvitationStatus(invitation);

      // Status filter
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      // Search filter (email or organization name)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesEmail = invitation.email.toLowerCase().includes(query);
        const matchesOrg = (invitation.organization_name || '')
          .toLowerCase()
          .includes(query);
        if (!matchesEmail && !matchesOrg) {
          return false;
        }
      }

      return true;
    });
  }, [invitations, statusFilter, searchQuery]);

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Invitation link copied to clipboard!');
  };

  if (isLoading || orgsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Loading invitations...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Invitation Management
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Create and manage user invitations
          </p>
        </div>
        {(canCreate || canCreatePrimary) && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md transition-colors"
          >
            {showCreateForm ? 'Cancel' : '+ Create Invitation'}
          </button>
        )}
      </div>

      {/* Token Display Modal */}
      {createdToken && (
        <div className="bg-indigo-900/20 border border-indigo-700/50 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-indigo-300 mb-2">
                Invitation Created!
              </h3>
              <p className="text-xs text-slate-300 mb-3">
                Share this link with the invited user. This token will only be
                shown once.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/accept-invite?token=${createdToken}`}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono"
                />
                <button
                  onClick={() => copyInviteLink(createdToken)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition-colors"
                >
                  Copy Link
                </button>
              </div>
            </div>
            <button
              onClick={() => setCreatedToken(null)}
              className="ml-4 text-slate-400 hover:text-slate-200"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Access Denied Message */}
      {!canCreate && !canCreatePrimary && !showCreateForm && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm">
              You don't have permission to create invitations. Contact your
              administrator if you need access.
            </span>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 shrink-0">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            Create New Invitation
          </h3>
          <form onSubmit={handleCreateInvitation} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address *
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Organization *
              </label>
              <select
                value={formOrganizationId}
                onChange={(e) => {
                  const newOrgId = e.target.value ? Number(e.target.value) : '';
                  setFormOrganizationId(newOrgId);
                  // Reset site selection when organization changes
                  setFormSiteIds([]);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="">Select organization...</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Site Selector - only show when organization is selected */}
            {formOrganizationId && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Sites (optional)
                  <span className="text-slate-500 ml-1 font-normal">
                    - Leave empty for all sites
                  </span>
                </label>
                {sitesLoading ? (
                  <div className="text-xs text-slate-400 py-2">
                    Loading sites...
                  </div>
                ) : sites.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">
                    No sites found for this organization
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-600 rounded p-2 bg-slate-950">
                    {sites.map((site) => (
                      <label
                        key={site.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-slate-800/50 p-1.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={formSiteIds.includes(site.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormSiteIds([...formSiteIds, site.id]);
                            } else {
                              setFormSiteIds(
                                formSiteIds.filter((id) => id !== site.id)
                              );
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-200">
                          {site.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Role *
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as OrgRole)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="admin">{getRoleDisplayName('admin')}</option>
                <option value="bookings_team">
                  {getRoleDisplayName('bookings_team')}
                </option>
                <option value="snc_coach">
                  {getRoleDisplayName('snc_coach')}
                </option>
                <option value="fitness_coach">
                  {getRoleDisplayName('fitness_coach')}
                </option>
                <option value="customer_service_assistant">
                  {getRoleDisplayName('customer_service_assistant')}
                </option>
                <option value="duty_manager">
                  {getRoleDisplayName('duty_manager')}
                </option>
                <option value="facility_manager">
                  {getRoleDisplayName('facility_manager')}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Expires In (days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={formExpiresInDays}
                onChange={(e) =>
                  setFormExpiresInDays(Number(e.target.value) || 7)
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={createInvitationLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
              >
                {createInvitationLoading ? 'Creating...' : 'Create Invitation'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by email or organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as InvitationStatus | 'all')
          }
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Invitations List */}
      <div className="flex-1 min-h-0">
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Sites
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Expires
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredInvitations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      {invitations.length === 0
                        ? 'No invitations found. Create one to get started.'
                        : 'No invitations match your filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredInvitations.map((invitation) => {
                    const status = getInvitationStatus(invitation);
                    const isPending = status === 'pending';

                    return (
                      <tr
                        key={invitation.id}
                        className="hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-slate-200">
                          {invitation.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {invitation.organization_name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {getRoleDisplayName(invitation.role)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {invitation.site_names &&
                          invitation.site_names.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {invitation.site_names.map((name, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">
                              All sites
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {format(
                            parseISO(invitation.expires_at),
                            'MMM d, yyyy'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {format(
                            parseISO(invitation.created_at),
                            'MMM d, yyyy'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isPending ? (
                              <InvitationActions
                                invitation={invitation}
                                isPending={isPending}
                                onResend={() => handleResend(invitation.id)}
                                onRevoke={() => handleRevoke(invitation.id)}
                                resendLoading={resendInvitationLoading}
                                revokeLoading={revokeInvitationLoading}
                              />
                            ) : status === 'accepted' ? (
                              <span className="text-xs text-slate-500">
                                Accepted{' '}
                                {invitation.accepted_at &&
                                  format(
                                    parseISO(invitation.accepted_at),
                                    'MMM d, yyyy'
                                  )}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Revoke Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={revokingInvitationId !== null}
        title="Revoke Invitation"
        message="Are you sure you want to revoke this invitation? This action cannot be undone."
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        onConfirm={confirmRevoke}
        onCancel={() => setRevokingInvitationId(null)}
        confirmVariant="danger"
      />
    </div>
  );
}
