type OrganizationOption = { id: number; name: string };
type SiteOption = { id: number; name: string };

type PlayersToolbarProps = {
  organizations: OrganizationOption[];
  sites: SiteOption[];
  activeOrgId: number | null;
  formOrganizationId: number | '';
  formSiteId: number | '';
  sitesLoading: boolean;
  bulkBaseUrl: string;
  bulkApplying: boolean;
  visiblePlayersCount: number;
  agentUpdateManifestUrl: string;
  onChangeOrganization: (organizationId: number | '') => void;
  onChangeSite: (siteId: number | '') => void;
  onChangeBulkBaseUrl: (value: string) => void;
  onApplyBaseUrl: () => void;
  onChangeAgentManifestUrl: (value: string) => void;
  onOpenCreateModal: () => void;
};

export function PlayersToolbar({
  organizations,
  sites,
  activeOrgId,
  formOrganizationId,
  formSiteId,
  sitesLoading,
  bulkBaseUrl,
  bulkApplying,
  visiblePlayersCount,
  agentUpdateManifestUrl,
  onChangeOrganization,
  onChangeSite,
  onChangeBulkBaseUrl,
  onApplyBaseUrl,
  onChangeAgentManifestUrl,
  onOpenCreateModal,
}: PlayersToolbarProps) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 shrink-0">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Organization
            </label>
            <select
              value={formOrganizationId}
              onChange={(event) =>
                onChangeOrganization(
                  event.target.value ? Number(event.target.value) : ''
                )
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select organization...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Site filter
            </label>
            {activeOrgId ? (
              <select
                value={formSiteId}
                onChange={(event) =>
                  onChangeSite(
                    event.target.value ? Number(event.target.value) : ''
                  )
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All sites</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-slate-500 py-2">
                Select an organization first.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {sitesLoading && activeOrgId && (
            <span className="text-xs text-slate-500">Loading sites...</span>
          )}
          {activeOrgId && (
            <details className="group relative">
              <summary className="list-none cursor-pointer px-2 py-2 text-xs text-slate-400 hover:text-slate-200">
                Advanced
              </summary>
              <div className="absolute right-0 mt-1 w-[320px] rounded border border-slate-700 bg-slate-900 p-3 shadow-xl z-20">
                <div className="text-xs text-slate-300 mb-2">
                  Update URL base for current filtered players and unpaired base
                  for this organization.
                </div>
                <input
                  type="url"
                  value={bulkBaseUrl}
                  onChange={(event) => onChangeBulkBaseUrl(event.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="https://facilityos.co.uk"
                />
                <button
                  type="button"
                  onClick={onApplyBaseUrl}
                  disabled={bulkApplying || visiblePlayersCount === 0}
                  className="mt-2 w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm rounded disabled:opacity-50"
                >
                  {bulkApplying ? 'Applying...' : 'Apply URL base'}
                </button>
                <div className="my-3 border-t border-slate-700" />
                <div className="text-xs text-slate-300 mb-2">
                  Agent update controls
                </div>
                <input
                  type="url"
                  value={agentUpdateManifestUrl}
                  onChange={(event) =>
                    onChangeAgentManifestUrl(event.target.value)
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="https://.../manifest.json"
                />
                <p className="mt-2 text-[11px] text-slate-400">
                  Update icons appear per player only when a newer version is
                  available.
                </p>
              </div>
            </details>
          )}
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors"
          >
            Create player
          </button>
        </div>
      </div>
    </div>
  );
}
