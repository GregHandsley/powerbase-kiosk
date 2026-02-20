import type { FormEvent } from 'react';
import type { SideKey, PowerState } from './types';
import { ModalPortal } from '../../../shared/ModalPortal';

type OrganizationOption = { id: number; name: string };
type SiteOption = { id: number; name: string };

type CreatePlayerModalProps = {
  isOpen: boolean;
  organizations: OrganizationOption[];
  sites: SiteOption[];
  activeOrgId: number | null;
  canSubmit: boolean;
  createPlayerLoading: boolean;
  selectedSiteLabel: string;
  formOrganizationId: number | '';
  formSiteId: number | '';
  sideKey: SideKey;
  name: string;
  location: string;
  desiredUrl: string;
  powerState: PowerState;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onChangeOrganization: (organizationId: number | '') => void;
  onChangeSite: (siteId: number | '') => void;
  onChangeSideKey: (sideKey: SideKey) => void;
  onChangeName: (value: string) => void;
  onChangeLocation: (value: string) => void;
  onChangeDesiredUrl: (value: string) => void;
  onChangePowerState: (value: PowerState) => void;
};

export function CreatePlayerModal({
  isOpen,
  organizations,
  sites,
  activeOrgId,
  canSubmit,
  createPlayerLoading,
  selectedSiteLabel,
  formOrganizationId,
  formSiteId,
  sideKey,
  name,
  location,
  desiredUrl,
  powerState,
  onClose,
  onSubmit,
  onChangeOrganization,
  onChangeSite,
  onChangeSideKey,
  onChangeName,
  onChangeLocation,
  onChangeDesiredUrl,
  onChangePowerState,
}: CreatePlayerModalProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4">
        <div className="absolute inset-0" onClick={onClose} />
        <div className="relative z-10 w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Create Player
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Organization *
                </label>
                <select
                  value={formOrganizationId}
                  onChange={(event) =>
                    onChangeOrganization(
                      event.target.value ? Number(event.target.value) : ''
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
                  Site
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
                    Select an organization to choose a site.
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Side
              </label>
              <select
                value={sideKey}
                onChange={(event) =>
                  onChangeSideKey(event.target.value as SideKey)
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="Base">Base</option>
                <option value="Power">Power</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Player Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => onChangeName(event.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Powerbase Kiosk 1"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(event) => onChangeLocation(event.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Zone A, North wall"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Desired URL
              </label>
              <input
                type="url"
                value={desiredUrl}
                onChange={(event) => onChangeDesiredUrl(event.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://facilityos.co.uk/kiosk"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Desired Power State
              </label>
              <select
                value={powerState}
                onChange={(event) =>
                  onChangePowerState(event.target.value as PowerState)
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
              >
                {createPlayerLoading ? 'Creating...' : 'Create Player'}
              </button>
              <div className="text-xs text-slate-400">
                {activeOrgId
                  ? `Targeting ${selectedSiteLabel}`
                  : 'Select an organization to continue.'}
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
