import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useOrganizations } from '../../../hooks/useOrganizations';
import { useSites } from '../../../hooks/useSites';
import { usePlayers } from '../../../hooks/usePlayers';
import { usePrimaryOrganizationId } from '../../../hooks/usePermissions';
import { supabase } from '../../../lib/supabaseClient';
import { CreatePlayerModal } from './playerManagement/CreatePlayerModal';
import { PairDeviceModal } from './playerManagement/PairDeviceModal';
import { PlayerActionMenu } from './playerManagement/PlayerActionMenu';
import { PlayerMetricsModal } from './playerManagement/PlayerMetricsModal';
import { PlayersTable } from './playerManagement/PlayersTable';
import { PlayersToolbar } from './playerManagement/PlayersToolbar';
import type {
  CommandLoadingState,
  MenuPlacement,
  MenuPosition,
  PlayerListItem,
  PowerState,
  SideKey,
} from './playerManagement/types';
import { hasAgentUpdateAvailable } from './playerManagement/utils';

export function PlayerManagement() {
  const queryClient = useQueryClient();
  const { organizations, isLoading: orgsLoading } = useOrganizations();
  const { organizationId: primaryOrgId } = usePrimaryOrganizationId();

  const [formOrganizationId, setFormOrganizationId] = useState<number | ''>('');
  const [formSiteId, setFormSiteId] = useState<number | ''>('');
  const [sideKey, setSideKey] = useState<SideKey>('Base');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [desiredUrl, setDesiredUrl] = useState('');
  const [powerState, setPowerState] = useState<PowerState>('on');

  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDesiredUrl, setEditDesiredUrl] = useState('');
  const [editPowerState, setEditPowerState] = useState<PowerState>('on');
  const [editSideKey, setEditSideKey] = useState<SideKey>('Base');

  const [commandLoading, setCommandLoading] =
    useState<CommandLoadingState>(null);
  const [deletingPlayerId, setDeletingPlayerId] = useState<number | null>(null);

  const [menuOpenPlayerId, setMenuOpenPlayerId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement>('below');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [metricsModalPlayerId, setMetricsModalPlayerId] = useState<
    number | null
  >(null);
  const [pairModalPlayerId, setPairModalPlayerId] = useState<number | null>(
    null
  );
  const [createFormPairingCode, setCreateFormPairingCode] = useState('');

  const [bulkBaseUrl, setBulkBaseUrl] = useState('https://facilityos.co.uk');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [agentUpdateManifestUrl, setAgentUpdateManifestUrl] = useState('');
  const [latestManifestVersion, setLatestManifestVersion] = useState<
    string | null
  >(null);
  const [manifestVersionLoading, setManifestVersionLoading] = useState(false);

  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionTriggerRefs = useRef<Record<number, HTMLButtonElement | null>>(
    {}
  );

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
    pairDeviceLoading,
  } = usePlayers(activeOrgId);

  const canSubmit =
    !!activeOrgId && name.trim().length > 0 && !createPlayerLoading;

  const selectedSiteLabel = useMemo(() => {
    if (!formSiteId) return 'All sites';
    const site = sites.find((s) => s.id === formSiteId);
    return site?.name ?? 'Unknown';
  }, [formSiteId, sites]);

  const visiblePlayers = useMemo(() => {
    if (!formSiteId) return players;
    return players.filter((player) => player.site_id === formSiteId);
  }, [players, formSiteId]);

  const activeOrganizationSettings = useMemo(() => {
    if (!activeOrgId) return {};
    const organization = organizations.find((org) => org.id === activeOrgId);
    return (organization?.settings ?? {}) as Record<string, unknown>;
  }, [activeOrgId, organizations]);

  useEffect(() => {
    const manifestUrl =
      typeof activeOrganizationSettings.player_agent_update_manifest_url ===
      'string'
        ? activeOrganizationSettings.player_agent_update_manifest_url
        : '';
    setAgentUpdateManifestUrl(manifestUrl);
  }, [activeOrganizationSettings]);

  useEffect(() => {
    const manifestUrl = agentUpdateManifestUrl.trim();
    if (!manifestUrl) {
      setLatestManifestVersion(null);
      return;
    }

    let isCancelled = false;
    const loadManifestVersion = async () => {
      try {
        setManifestVersionLoading(true);
        const response = await fetch(manifestUrl, { method: 'GET' });
        if (!response.ok) {
          throw new Error(`Manifest request failed (${response.status})`);
        }
        const json = (await response.json()) as { version?: unknown };
        const version =
          typeof json.version === 'string' && json.version.trim()
            ? json.version.trim()
            : null;
        if (!isCancelled) {
          setLatestManifestVersion(version);
        }
      } catch {
        if (!isCancelled) {
          setLatestManifestVersion(null);
        }
      } finally {
        if (!isCancelled) {
          setManifestVersionLoading(false);
        }
      }
    };

    void loadManifestVersion();
    return () => {
      isCancelled = true;
    };
  }, [agentUpdateManifestUrl]);

  const startEdit = (player: PlayerListItem) => {
    setEditingPlayerId(player.id);
    setEditName(player.name);
    setEditLocation(player.location ?? '');
    setEditDesiredUrl(player.desired_url ?? '');
    setEditPowerState(player.desired_power_state);
    setEditSideKey((player.side_key ?? 'Base') as SideKey);
  };

  const cancelEdit = () => {
    setEditingPlayerId(null);
    setEditName('');
    setEditLocation('');
    setEditDesiredUrl('');
    setEditPowerState('on');
    setEditSideKey('Base');
  };

  const handleCreatePlayer = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!activeOrgId || !name.trim()) {
      toast.error('Please provide a player name and organization.');
      return;
    }

    const codeToPair = createFormPairingCode.trim();

    try {
      const data = await createPlayer({
        organization_id: activeOrgId,
        site_id: formSiteId ? (formSiteId as number) : null,
        side_key: sideKey,
        name,
        location: location.trim() || null,
        desired_url: desiredUrl.trim() || null,
        desired_power_state: powerState,
      });

      if (codeToPair && data?.id) {
        await pairDevice({ player_id: data.id, code: codeToPair });
        toast.success('Player created and device paired.');
      } else {
        toast.success('Player created.');
      }

      setName('');
      setLocation('');
      setDesiredUrl('');
      setPowerState('on');
      setSideKey('Base');
      setFormSiteId('');
      setCreateFormPairingCode('');
      setIsCreateModalOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create player'
      );
    }
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
      case 'agent_update':
        return 'Update agent';
      default:
        return commandType.replace(/_/g, ' ');
    }
  };

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
    const estimatedMenuHeight = 320;
    let top = rect.bottom + 10;
    let placement: MenuPlacement = 'below';
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

  const handleDeletePlayer = async (playerId: number, playerName: string) => {
    const confirmed = window.confirm(
      `Delete player "${playerName}"?\n\nThis removes the player and related pairing/device records.`
    );
    if (!confirmed) return;

    try {
      setDeletingPlayerId(playerId);
      await deletePlayer({ id: playerId });
      toast.success('Player deleted.');
      closeActionMenu();
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
      if (error) throw error;

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

  const invokeAgentUpdate = async (playerId: number) => {
    const payload = agentUpdateManifestUrl.trim()
      ? { manifest_url: agentUpdateManifestUrl.trim() }
      : {};
    const { error } = await supabase.functions.invoke('admin-player-commands', {
      body: {
        player_id: playerId,
        type: 'agent_update',
        payload,
      },
    });
    if (error) throw error;
  };

  const handleUpdateSingleAgent = async (playerId: number) => {
    try {
      setCommandLoading({ playerId, type: 'agent_update' });
      await invokeAgentUpdate(playerId);
      closeActionMenu();
      toast.success('Agent update queued.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to queue agent update'
      );
    } finally {
      setCommandLoading(null);
    }
  };

  const handleApplyBaseUrl = async () => {
    if (!activeOrgId) {
      toast.error('Select an organization first.');
      return;
    }
    const base = bulkBaseUrl.trim();
    if (!base) {
      toast.error('Enter a base URL.');
      return;
    }

    let baseOrigin: string;
    try {
      baseOrigin = new URL(base).origin;
    } catch {
      toast.error('Base URL is invalid.');
      return;
    }

    const targetPlayers = visiblePlayers.filter(
      (player) => typeof player.desired_url === 'string' && !!player.desired_url
    );
    if (targetPlayers.length === 0) {
      toast.error('No players with a desired URL in the current scope.');
      return;
    }

    const confirmed = window.confirm(
      `Apply base URL "${baseOrigin}" to ${targetPlayers.length} player(s) in ${selectedSiteLabel}?`
    );
    if (!confirmed) return;

    const remapDesiredUrl = (input: string) => {
      try {
        const current = new URL(input);
        return `${baseOrigin}${current.pathname}${current.search}${current.hash}`;
      } catch {
        return input;
      }
    };

    try {
      setBulkApplying(true);
      await Promise.all(
        targetPlayers.map((player) =>
          updatePlayer({
            id: player.id,
            desired_url: remapDesiredUrl(player.desired_url || ''),
          })
        )
      );

      const nextSettings = {
        ...activeOrganizationSettings,
        kiosk_app_base: baseOrigin,
      };
      const { error: settingsError } = await supabase
        .from('organizations')
        .update({ settings: nextSettings })
        .eq('id', activeOrgId);
      if (settingsError) throw settingsError;

      await queryClient.invalidateQueries({
        queryKey: ['players', activeOrgId],
      });
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });

      toast.success(`Updated ${targetPlayers.length} player URL(s).`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update player URLs'
      );
    } finally {
      setBulkApplying(false);
    }
  };

  const activeMenuPlayer = useMemo(
    () =>
      visiblePlayers.find((player) => player.id === menuOpenPlayerId) ?? null,
    [visiblePlayers, menuOpenPlayerId]
  );

  const metricsModalPlayer = useMemo(
    () => players.find((player) => player.id === metricsModalPlayerId) ?? null,
    [players, metricsModalPlayerId]
  );

  const pairModalPlayer = useMemo(
    () => players.find((player) => player.id === pairModalPlayerId) ?? null,
    [players, pairModalPlayerId]
  );

  const handlePairDevice = async (playerId: number, code: string) => {
    try {
      await pairDevice({ player_id: playerId, code });
      toast.success('Device paired. The kiosk will connect shortly.');
      setPairModalPlayerId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to pair device'
      );
    }
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
      if (event.key === 'Escape') closeActionMenu();
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

  useEffect(() => {
    if (!metricsModalPlayerId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMetricsModalPlayerId(null);
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [metricsModalPlayerId]);

  useEffect(() => {
    if (!pairModalPlayerId) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPairModalPlayerId(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [pairModalPlayerId]);

  if (orgsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Loading players...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto min-h-0">
      <PlayersToolbar
        organizations={organizations}
        sites={sites}
        activeOrgId={activeOrgId}
        formOrganizationId={formOrganizationId}
        formSiteId={formSiteId}
        sitesLoading={sitesLoading}
        bulkBaseUrl={bulkBaseUrl}
        bulkApplying={bulkApplying}
        visiblePlayersCount={visiblePlayers.length}
        agentUpdateManifestUrl={agentUpdateManifestUrl}
        onChangeOrganization={(organizationId) => {
          setFormOrganizationId(organizationId);
          setFormSiteId('');
        }}
        onChangeSite={setFormSiteId}
        onChangeBulkBaseUrl={setBulkBaseUrl}
        onApplyBaseUrl={handleApplyBaseUrl}
        onChangeAgentManifestUrl={setAgentUpdateManifestUrl}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
      />

      <PlayersTable
        playersLoading={playersLoading}
        activeOrgId={activeOrgId}
        visiblePlayers={visiblePlayers}
        latestManifestVersion={latestManifestVersion}
        manifestVersionLoading={manifestVersionLoading}
        editingPlayerId={editingPlayerId}
        editName={editName}
        editLocation={editLocation}
        editDesiredUrl={editDesiredUrl}
        editPowerState={editPowerState}
        editSideKey={editSideKey}
        updatePlayerLoading={updatePlayerLoading}
        commandLoading={commandLoading}
        onSetEditName={setEditName}
        onSetEditLocation={setEditLocation}
        onSetEditDesiredUrl={setEditDesiredUrl}
        onSetEditPowerState={setEditPowerState}
        onSetEditSideKey={setEditSideKey}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={cancelEdit}
        onUpdateAgent={handleUpdateSingleAgent}
        onOpenActionMenu={openActionMenu}
        onSetActionTriggerRef={(playerId, element) => {
          actionTriggerRefs.current[playerId] = element;
        }}
      />

      <PlayerActionMenu
        isOpen={!!menuOpenPlayerId}
        position={menuPosition}
        placement={menuPlacement}
        activePlayer={activeMenuPlayer}
        actionMenuRef={actionMenuRef}
        commandLoading={commandLoading}
        deletingPlayerId={deletingPlayerId}
        deletePlayerLoading={deletePlayerLoading}
        canUpdateAgent={(player) =>
          hasAgentUpdateAvailable(player, latestManifestVersion)
        }
        onClose={closeActionMenu}
        onStartEdit={startEdit}
        onOpenMetrics={setMetricsModalPlayerId}
        onSendCommand={(playerId, type) => {
          void handleSendCommand(playerId, type);
        }}
        onUpdateAgent={(playerId) => {
          void handleUpdateSingleAgent(playerId);
        }}
        onDeletePlayer={(playerId, playerName) => {
          void handleDeletePlayer(playerId, playerName);
        }}
        onOpenPairModal={(player) => setPairModalPlayerId(player.id)}
      />

      <PairDeviceModal
        isOpen={!!pairModalPlayer}
        playerName={pairModalPlayer?.name ?? ''}
        playerId={pairModalPlayer?.id ?? 0}
        loading={pairDeviceLoading}
        onClose={() => setPairModalPlayerId(null)}
        onPair={handlePairDevice}
      />

      <PlayerMetricsModal
        player={metricsModalPlayer}
        commandLoading={commandLoading}
        latestManifestVersion={latestManifestVersion}
        onClose={() => setMetricsModalPlayerId(null)}
        onUpdateAgent={(playerId) => {
          void handleUpdateSingleAgent(playerId);
        }}
      />

      <CreatePlayerModal
        isOpen={isCreateModalOpen}
        organizations={organizations}
        sites={sites}
        activeOrgId={activeOrgId}
        canSubmit={canSubmit}
        createPlayerLoading={createPlayerLoading}
        selectedSiteLabel={selectedSiteLabel}
        formOrganizationId={formOrganizationId}
        formSiteId={formSiteId}
        sideKey={sideKey}
        name={name}
        location={location}
        desiredUrl={desiredUrl}
        powerState={powerState}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreatePlayer}
        onChangeOrganization={(organizationId) => {
          setFormOrganizationId(organizationId);
          setFormSiteId('');
        }}
        onChangeSite={setFormSiteId}
        onChangeSideKey={setSideKey}
        onChangeName={setName}
        onChangeLocation={setLocation}
        onChangeDesiredUrl={setDesiredUrl}
        onChangePowerState={setPowerState}
        pairingCode={createFormPairingCode}
        onChangePairingCode={setCreateFormPairingCode}
        pairDeviceLoading={pairDeviceLoading}
      />
    </div>
  );
}
