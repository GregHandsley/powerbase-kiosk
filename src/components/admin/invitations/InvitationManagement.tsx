import { useState } from 'react';
import { useInvitations } from '../../../hooks/useInvitations';
import { useOrganizations } from '../../../hooks/useOrganizations';
import toast from 'react-hot-toast';
import { format, parseISO, isAfter } from 'date-fns';

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
  const [formRole, setFormRole] = useState<'admin' | 'coach'>('coach');
  const [formExpiresInDays, setFormExpiresInDays] = useState(7);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

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
      });

      toast.success('Invitation created successfully!');
      setCreatedToken(result.token);
      setFormEmail('');
      setFormOrganizationId('');
      setFormRole('coach');
      setFormExpiresInDays(7);
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
    if (!confirm('Are you sure you want to revoke this invitation?')) {
      return;
    }

    try {
      await revokeInvitation(invitationId);
      toast.success('Invitation revoked');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to revoke invitation'
      );
    }
  };

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
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md transition-colors"
        >
          {showCreateForm ? 'Cancel' : '+ Create Invitation'}
        </button>
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
                onChange={(e) =>
                  setFormOrganizationId(
                    e.target.value ? Number(e.target.value) : ''
                  )
                }
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

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Role *
              </label>
              <select
                value={formRole}
                onChange={(e) =>
                  setFormRole(e.target.value as 'admin' | 'coach')
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="coach">Coach</option>
                <option value="admin">Admin</option>
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
                {invitations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      No invitations found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  invitations.map((invitation) => {
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
                        <td className="px-4 py-3 text-sm text-slate-300 capitalize">
                          {invitation.role}
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
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleResend(invitation.id)}
                                  disabled={resendInvitationLoading}
                                  className="px-2 py-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline disabled:opacity-50"
                                  title="Resend invitation (rotate token)"
                                >
                                  Resend
                                </button>
                                <button
                                  onClick={() => handleRevoke(invitation.id)}
                                  disabled={revokeInvitationLoading}
                                  className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:underline disabled:opacity-50"
                                  title="Revoke invitation"
                                >
                                  Revoke
                                </button>
                              </>
                            )}
                            {status === 'accepted' && (
                              <span className="text-xs text-slate-500">
                                Accepted{' '}
                                {invitation.accepted_at &&
                                  format(
                                    parseISO(invitation.accepted_at),
                                    'MMM d, yyyy'
                                  )}
                              </span>
                            )}
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
    </div>
  );
}
