import { useEffect, useMemo, useRef, useState } from 'react';
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
    updatePlayer,
    updatePlayerLoading,
    deletePlayer,
    deletePlayerLoading,
    pairDevice,
  } = usePlayers(activeOrgId);
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
  const [deletingPlayerId, setDeletingPlayerId] = useState<number | null>(null);
  const [menuOpenPlayerId, setMenuOpenPlayerId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<'above' | 'below'>(
    'below'
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionTriggerRefs = useRef<Record<number, HTMLButtonElement | null>>(
    {}
  );

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
      toast.success(
        'Player created. Use the row Actions menu to pair a kiosk code.'
      );
      setName('');
      setLocation('');
      setDesiredUrl('');
      setPowerState('on');
      setSideKey('Base');
      setFormSiteId('');
      setIsCreateModalOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create player'
      );
    }
  };

  const handleQuickPair = async (playerId: number) => {
    const input = window.prompt(
      'Enter the pairing code shown on the kiosk (e.g. ABC-123-45):'
    );
    if (!input || !input.trim()) return;

    try {
      await pairDevice({ player_id: playerId, code: input.trim() });
      toast.success('Device paired. The kiosk will connect shortly.');
      setMenuOpenPlayerId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to pair device'
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

  const handleDeletePlayer = async (playerId: number, playerName: string) => {
    const confirmed = window.confirm(
      `Delete player "${playerName}"?\n\nThis removes the player and related pairing/device records.`
    );
    if (!confirmed) return;

    try {
      setDeletingPlayerId(playerId);
      await deletePlayer({ id: playerId });
      toast.success('Player deleted.');
      setMenuOpenPlayerId(null);
      setMenuPosition(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete player'
      );
    } finally {
      setDeletingPlayerId(null);
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
      if (type === 'display_on' || type === 'display_off') {
        await updatePlayer({
          id: playerId,
          desired_power_state: type === 'display_on' ? 'on' : 'off',
        });
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

  const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
  const formatUptime = (uptimeSeconds: number) => {
    const total = Math.max(0, Math.floor(uptimeSeconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };
  const getHealthSummary = (
    meta: Record<string, unknown> | null | undefined
  ) => {
    if (!meta) return null;

    const parts: string[] = [];
    const cpu = meta.cpu_percent;
    const temp = meta.temp_c;
    const memory = meta.memory_percent;
    const chromiumRunning = meta.chromium_running;
    const uptime = meta.uptime_seconds;

    if (typeof cpu === 'number') {
      parts.push(`CPU ${Math.round(cpu)}%`);
    }
    if (typeof temp === 'number') {
      parts.push(`${Math.round(temp)}C`);
    }
    if (typeof memory === 'number') {
      parts.push(`Mem ${Math.round(memory)}%`);
    }
    if (typeof chromiumRunning === 'boolean') {
      parts.push(chromiumRunning ? 'Chromium on' : 'Chromium off');
    }
    if (typeof uptime === 'number') {
      parts.push(`Up ${formatUptime(uptime)}`);
    }

    return parts.length > 0 ? parts.join(' • ') : null;
  };
  const activeMenuPlayer = useMemo(
    () => players.find((player) => player.id === menuOpenPlayerId) ?? null,
    [players, menuOpenPlayerId]
  );
  const closeActionMenu = () => {
    setMenuOpenPlayerId(null);
    setMenuPosition(null);
  };

  const openActionMenu = (
    playerId: number,
    triggerButton: HTMLButtonElement | null
  ) => {
    if (!triggerButton) return;

    if (menuOpenPlayerId === playerId) {
      closeActionMenu();
      return;
    }

    const rect = triggerButton.getBoundingClientRect();
    const menuWidth = 208;
    const estimatedMenuHeight = 280;
    let top = rect.bottom + 10;
    let placement: 'above' | 'below' = 'below';
    if (top + estimatedMenuHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - estimatedMenuHeight - 10);
      placement = 'above';
    }
    const left = Math.min(
      Math.max(12, rect.right - menuWidth),
      window.innerWidth - menuWidth - 12
    );

    setMenuPlacement(placement);
    setMenuPosition({ top, left });
    setMenuOpenPlayerId(playerId);
  };

  useEffect(() => {
    if (!menuOpenPlayerId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const trigger = actionTriggerRefs.current[menuOpenPlayerId];
      const clickedMenu = actionMenuRef.current?.contains(target) ?? false;
      const clickedTrigger = trigger?.contains(target) ?? false;
      if (!clickedMenu && !clickedTrigger) {
        closeActionMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeActionMenu();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', closeActionMenu);
    window.addEventListener('scroll', closeActionMenu, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', closeActionMenu);
      window.removeEventListener('scroll', closeActionMenu, true);
    };
  }, [menuOpenPlayerId]);

  useEffect(() => {
    if (!isCreateModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCreateModalOpen(false);
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isCreateModalOpen]);

  if (orgsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Loading players...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto min-h-0">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 shrink-0">
        <div className="flex flex-wrap items-end gap-4 justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Organization
              </label>
              <select
                value={formOrganizationId}
                onChange={(e) => {
                  const orgId = e.target.value ? Number(e.target.value) : '';
                  setFormOrganizationId(orgId);
                  setFormSiteId('');
                }}
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
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors"
            >
              Create player
            </button>
          </div>
        </div>
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
                        {player.has_revoked_device
                          ? 'Revoked'
                          : player.last_seen_at || player.online_since
                            ? 'Paired'
                            : 'Not paired'}
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
                            const healthSummary = getHealthSummary(
                              player.device_meta as Record<
                                string,
                                unknown
                              > | null
                            );
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
                                {healthSummary && (
                                  <span className="text-xs text-slate-500">
                                    {healthSummary}
                                  </span>
                                )}
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
                        ) : player.desired_power_state === 'on' ? (
                          'On'
                        ) : (
                          'Off'
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
                          <div className="inline-flex justify-end">
                            <button
                              type="button"
                              ref={(element) => {
                                actionTriggerRefs.current[player.id] = element;
                              }}
                              onClick={() =>
                                openActionMenu(
                                  player.id,
                                  actionTriggerRefs.current[player.id]
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-slate-100"
                              aria-label={`Actions for ${player.name}`}
                            >
                              ⋮
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

      {menuOpenPlayerId && menuPosition && activeMenuPlayer && (
        <div
          ref={actionMenuRef}
          className="fixed z-50 w-52 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div
            className={`absolute h-2 w-2 rotate-45 bg-slate-900 ${
              menuPlacement === 'below'
                ? '-top-1 right-4 border-l border-t border-slate-700'
                : '-bottom-1 right-4 border-r border-b border-slate-700'
            }`}
          />
          <button
            type="button"
            onClick={() => {
              startEdit({
                id: activeMenuPlayer.id,
                name: activeMenuPlayer.name,
                location: activeMenuPlayer.location,
                desired_url: activeMenuPlayer.desired_url,
                desired_power_state: activeMenuPlayer.desired_power_state,
                side_key: activeMenuPlayer.side_key,
              });
              closeActionMenu();
            }}
            className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
          >
            Edit player
          </button>
          <button
            type="button"
            onClick={() => handleQuickPair(activeMenuPlayer.id)}
            className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
          >
            Pair device
          </button>
          <button
            type="button"
            onClick={() => {
              closeActionMenu();
              handleSendCommand(activeMenuPlayer.id, 'display_on');
            }}
            disabled={commandLoading?.playerId === activeMenuPlayer.id}
            className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Display on
          </button>
          <button
            type="button"
            onClick={() => {
              closeActionMenu();
              handleSendCommand(activeMenuPlayer.id, 'display_off');
            }}
            disabled={commandLoading?.playerId === activeMenuPlayer.id}
            className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Display off
          </button>
          <button
            type="button"
            onClick={() => {
              closeActionMenu();
              handleSendCommand(activeMenuPlayer.id, 'reload');
            }}
            disabled={commandLoading?.playerId === activeMenuPlayer.id}
            className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              closeActionMenu();
              handleSendCommand(activeMenuPlayer.id, 'restart_kiosk');
            }}
            disabled={commandLoading?.playerId === activeMenuPlayer.id}
            className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Restart kiosk
          </button>
          <div className="my-1 border-t border-slate-700" />
          <button
            type="button"
            onClick={() =>
              handleDeletePlayer(activeMenuPlayer.id, activeMenuPlayer.name)
            }
            disabled={
              deletingPlayerId === activeMenuPlayer.id || deletePlayerLoading
            }
            className="w-full rounded px-2 py-1.5 text-left text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
          >
            {deletingPlayerId === activeMenuPlayer.id
              ? 'Deleting...'
              : 'Delete player'}
          </button>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4">
          <div
            className="absolute inset-0"
            onClick={() => setIsCreateModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">
                Create Player
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleCreatePlayer} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Organization *
                  </label>
                  <select
                    value={formOrganizationId}
                    onChange={(e) => {
                      const orgId = e.target.value
                        ? Number(e.target.value)
                        : '';
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
                        setFormSiteId(
                          e.target.value ? Number(e.target.value) : ''
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
                  onChange={(e) =>
                    setSideKey(e.target.value as 'Base' | 'Power')
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
                  onChange={(e) =>
                    setPowerState(e.target.value as 'on' | 'off')
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
      )}
    </div>
  );
}
