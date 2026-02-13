import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { useOrganizations } from '../../../hooks/useOrganizations';
import { useSites } from '../../../hooks/useSites';
import { usePlayers } from '../../../hooks/usePlayers';
import { usePrimaryOrganizationId } from '../../../hooks/usePermissions';
import { supabase } from '../../../lib/supabaseClient';

export function PlayerManagement() {
  const { organizations, isLoading: orgsLoading } = useOrganizations();
  const { organizationId: primaryOrgId } = usePrimaryOrganizationId();
  const [formOrganizationId, setFormOrganizationId] = useState<number | ''>('');
  const [formSiteId, setFormSiteId] = useState<number | ''>('');
  const [sideKey, setSideKey] = useState<'Base' | 'Power'>('Base');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [desiredUrl, setDesiredUrl] = useState('');
  const [powerState, setPowerState] = useState<'on' | 'off'>('on');

  useEffect(() => {
    if (!formOrganizationId && primaryOrgId) {
      setFormOrganizationId(primaryOrgId);
    }
  }, [formOrganizationId, primaryOrgId]);

  const activeOrgId =
    formOrganizationId !== '' ? (formOrganizationId as number) : null;
  const { sites, isLoading: sitesLoading } = useSites(activeOrgId);
  const {
    players,
    isLoading: playersLoading,
    createPlayer,
    createPlayerLoading,
    createPairingCode,
    createPairingCodeLoading,
    updatePlayer,
    updatePlayerLoading,
    revokeDevice,
    // revokeDeviceLoading,
  } = usePlayers(activeOrgId);
  const [latestPairing, setLatestPairing] = useState<{
    playerId: number;
    code: string;
    expiresAt: string;
  } | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDesiredUrl, setEditDesiredUrl] = useState('');
  const [editPowerState, setEditPowerState] = useState<'on' | 'off'>('on');
  const [editSideKey, setEditSideKey] = useState<'Base' | 'Power'>('Base');
  const [commandLoading, setCommandLoading] = useState<{
    playerId: number;
    type: string;
  } | null>(null);
  const [revokingPlayerId, setRevokingPlayerId] = useState<number | null>(null);

  const canSubmit =
    !!activeOrgId && name.trim().length > 0 && !createPlayerLoading;

  const selectedSiteLabel = useMemo(() => {
    if (!formSiteId) return 'All sites';
    const site = sites.find((s) => s.id === formSiteId);
    return site?.name ?? 'Unknown';
  }, [formSiteId, sites]);

  const handleCreatePlayer = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!activeOrgId || !name.trim()) {
      toast.error('Please provide a player name and organization.');
      return;
    }

    try {
      await createPlayer({
        organization_id: activeOrgId,
        site_id: formSiteId ? (formSiteId as number) : null,
        side_key: sideKey,
        name,
        location: location.trim() || null,
        desired_url: desiredUrl.trim() || null,
        desired_power_state: powerState,
      });
      toast.success('Player created successfully.');
      setName('');
      setLocation('');
      setDesiredUrl('');
      setPowerState('on');
      setSideKey('Base');
      setFormSiteId('');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create player'
      );
    }
  };

  const handleGeneratePairingCode = async (playerId: number) => {
    try {
      const result = await createPairingCode({ player_id: playerId });
      setLatestPairing({
        playerId,
        code: result.code,
        expiresAt: result.expires_at,
      });
      await navigator.clipboard.writeText(result.code);
      toast.success('Pairing code generated and copied.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to generate pairing code'
      );
    }
  };

  const startEdit = (player: {
    id: number;
    name: string;
    location: string | null;
    desired_url: string | null;
    desired_power_state: 'on' | 'off';
    side_key: 'Base' | 'Power' | null;
  }) => {
    setEditingPlayerId(player.id);
    setEditName(player.name);
    setEditLocation(player.location ?? '');
    setEditDesiredUrl(player.desired_url ?? '');
    setEditPowerState(player.desired_power_state);
    setEditSideKey(player.side_key ?? 'Base');
  };

  const cancelEdit = () => {
    setEditingPlayerId(null);
    setEditName('');
    setEditLocation('');
    setEditDesiredUrl('');
    setEditPowerState('on');
    setEditSideKey('Base');
  };

  const handleSaveEdit = async () => {
    if (!editingPlayerId) return;
    try {
      await updatePlayer({
        id: editingPlayerId,
        name: editName,
        location: editLocation,
        desired_url: editDesiredUrl,
        desired_power_state: editPowerState,
        side_key: editSideKey,
      });
      toast.success('Player updated.');
      cancelEdit();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update player'
      );
    }
  };

  const getCommandLabel = (commandType: string) => {
    switch (commandType) {
      case 'display_on':
        return 'Display on';
      case 'display_off':
        return 'Display off';
      case 'reload':
        return 'Reload';
      case 'restart_kiosk':
        return 'Restart kiosk';
      case 'set_url':
        return 'Set URL';
      case 'reboot':
        return 'Reboot';
      default:
        return commandType.replace(/_/g, ' ');
    }
  };

  const handleRevoke = async (playerId: number, rotate: boolean) => {
    try {
      setRevokingPlayerId(playerId);
      const result = await revokeDevice({ player_id: playerId, rotate });
      if (rotate && result?.pairing_code) {
        await navigator.clipboard.writeText(result.pairing_code);
        toast.success(
          `Device revoked. New pairing code copied (expires ${format(parseISO(result.expires_at), 'HH:mm')}).`
        );
      } else {
        toast.success(result?.message ?? 'Device revoked.');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to revoke device'
      );
    } finally {
      setRevokingPlayerId(null);
    }
  };

  const handleSendCommand = async (
    playerId: number,
    type: string,
    payload?: Record<string, unknown>
  ) => {
    try {
      setCommandLoading({ playerId, type });
      const { error } = await supabase.functions.invoke(
        'admin-player-commands',
        {
          body: {
            player_id: playerId,
            type,
            payload: payload ?? {},
          },
        }
      );
      if (error) {
        throw error;
      }
      toast.success(`Command sent: ${getCommandLabel(type)}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send command'
      );
    } finally {
      setCommandLoading(null);
    }
  };

  if (orgsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Loading players...</div>
      </div>
    );
  }

  const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto min-h-0">
      {/* Create Form */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 shrink-0">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">
          Create Player
        </h3>
        <form onSubmit={handleCreatePlayer} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Organization *
            </label>
            <select
              value={formOrganizationId}
              onChange={(e) => {
                const orgId = e.target.value ? Number(e.target.value) : '';
                setFormOrganizationId(orgId);
                setFormSiteId('');
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

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Site
            </label>
            {activeOrgId ? (
              <select
                value={formSiteId}
                onChange={(e) =>
                  setFormSiteId(e.target.value ? Number(e.target.value) : '')
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
              <div className="text-xs text-slate-500">
                Select an organization to choose a site.
              </div>
            )}
            {sitesLoading && activeOrgId && (
              <div className="text-xs text-slate-500 mt-1">
                Loading sites...
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Side
            </label>
            <select
              value={sideKey}
              onChange={(e) => setSideKey(e.target.value as 'Base' | 'Power')}
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
              onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => setLocation(e.target.value)}
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
              onChange={(e) => setDesiredUrl(e.target.value)}
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
              onChange={(e) => setPowerState(e.target.value as 'on' | 'off')}
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

      {/* Players List */}
      <div className="flex-1 min-h-0">
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Pairing
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Site
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Side
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Desired URL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Schedule
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                    Power
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
                {playersLoading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      Loading players...
                    </td>
                  </tr>
                ) : players.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      {activeOrgId
                        ? 'No players yet. Create one to get started.'
                        : 'Select an organization to view players.'}
                    </td>
                  </tr>
                ) : (
                  players.map((player) => (
                    <tr
                      key={player.id}
                      className="hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-200">
                        {editingPlayerId === player.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(event) =>
                              setEditName(event.target.value)
                            }
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          player.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => handleGeneratePairingCode(player.id)}
                            disabled={createPairingCodeLoading}
                            className="inline-flex items-center justify-center px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50"
                          >
                            {createPairingCodeLoading
                              ? 'Generating...'
                              : 'Generate code'}
                          </button>
                          {latestPairing?.playerId === player.id && (
                            <div className="text-xs text-slate-400">
                              Code:{' '}
                              <span className="font-mono">
                                {latestPairing.code}
                              </span>
                              <div>
                                Expires:{' '}
                                {format(
                                  parseISO(latestPairing.expiresAt),
                                  'HH:mm'
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {player.site_name || 'All sites'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {editingPlayerId === player.id ? (
                          <select
                            value={editSideKey}
                            onChange={(event) =>
                              setEditSideKey(
                                event.target.value as 'Base' | 'Power'
                              )
                            }
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="Base">Base</option>
                            <option value="Power">Power</option>
                          </select>
                        ) : (
                          player.side_key || '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {player.has_revoked_device && (
                          <span className="mr-2 inline-block rounded bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-400">
                            Revoked
                          </span>
                        )}
                        {player.last_seen_at ? (
                          (() => {
                            const lastSeenDate = parseISO(player.last_seen_at);
                            const isOnline =
                              Date.now() - lastSeenDate.getTime() <
                              ONLINE_THRESHOLD_MS;
                            const onlineSince = player.online_since
                              ? parseISO(player.online_since)
                              : null;
                            const durationLabel = isOnline
                              ? onlineSince
                                ? `Up for ${formatDistanceToNow(onlineSince)}`
                                : 'Up for just now'
                              : `Down for ${formatDistanceToNow(lastSeenDate)}`;
                            return (
                              <div className="flex flex-col">
                                <span
                                  className={
                                    isOnline
                                      ? 'text-green-400'
                                      : 'text-slate-500'
                                  }
                                >
                                  {isOnline ? 'Online' : 'Offline'}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {durationLabel}
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-slate-500">Down (no data)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {editingPlayerId === player.id ? (
                          <input
                            type="text"
                            value={editLocation}
                            onChange={(event) =>
                              setEditLocation(event.target.value)
                            }
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          player.location || '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {editingPlayerId === player.id ? (
                          <input
                            type="url"
                            value={editDesiredUrl}
                            onChange={(event) =>
                              setEditDesiredUrl(event.target.value)
                            }
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          player.desired_url || '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {player.site_id && player.side_key ? (
                          <Link
                            to={`/admin?view=capacity-schedule&side=${player.side_key}`}
                            className="text-xs text-indigo-300 hover:text-indigo-200"
                          >
                            View schedule
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Set site &amp; side
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {editingPlayerId === player.id ? (
                          <select
                            value={editPowerState}
                            onChange={(event) =>
                              setEditPowerState(
                                event.target.value as 'on' | 'off'
                              )
                            }
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="on">On</option>
                            <option value="off">Off</option>
                          </select>
                        ) : (
                          player.desired_power_state
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {format(parseISO(player.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {editingPlayerId === player.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={updatePlayerLoading}
                              className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50"
                            >
                              {updatePlayerLoading ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleRevoke(player.id, false)}
                              disabled={revokingPlayerId === player.id}
                              className="px-2 py-1 text-xs bg-amber-700 hover:bg-amber-600 text-white rounded disabled:opacity-50"
                            >
                              {revokingPlayerId === player.id
                                ? 'Revoking...'
                                : 'Revoke'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevoke(player.id, true)}
                              disabled={revokingPlayerId === player.id}
                              className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded disabled:opacity-50"
                            >
                              Rotate
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleSendCommand(player.id, 'display_on')
                              }
                              disabled={commandLoading?.playerId === player.id}
                              className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
                            >
                              Display On
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleSendCommand(player.id, 'display_off')
                              }
                              disabled={commandLoading?.playerId === player.id}
                              className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded disabled:opacity-50"
                            >
                              Display Off
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleSendCommand(player.id, 'reload')
                              }
                              disabled={commandLoading?.playerId === player.id}
                              className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50"
                            >
                              Reload
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleSendCommand(player.id, 'restart_kiosk')
                              }
                              disabled={commandLoading?.playerId === player.id}
                              className="px-2 py-1 text-xs bg-indigo-700 hover:bg-indigo-600 text-white rounded disabled:opacity-50"
                            >
                              Restart Kiosk
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                startEdit({
                                  id: player.id,
                                  name: player.name,
                                  location: player.location,
                                  desired_url: player.desired_url,
                                  desired_power_state:
                                    player.desired_power_state,
                                  side_key: player.side_key,
                                })
                              }
                              className="px-2 py-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
