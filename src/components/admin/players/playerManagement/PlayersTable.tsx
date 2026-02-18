import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import type {
  CommandLoadingState,
  PlayerListItem,
  PowerState,
  SideKey,
} from './types';
import {
  getAgentVersion,
  getDesiredUrlLabel,
  hasAgentUpdateAvailable,
  ONLINE_THRESHOLD_MS,
} from './utils';

type PlayersTableProps = {
  playersLoading: boolean;
  activeOrgId: number | null;
  visiblePlayers: PlayerListItem[];
  latestManifestVersion: string | null;
  manifestVersionLoading: boolean;
  editingPlayerId: number | null;
  editName: string;
  editLocation: string;
  editDesiredUrl: string;
  editPowerState: PowerState;
  editSideKey: SideKey;
  updatePlayerLoading: boolean;
  commandLoading: CommandLoadingState;
  onSetEditName: (value: string) => void;
  onSetEditLocation: (value: string) => void;
  onSetEditDesiredUrl: (value: string) => void;
  onSetEditPowerState: (value: PowerState) => void;
  onSetEditSideKey: (value: SideKey) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onUpdateAgent: (playerId: number) => void;
  onOpenActionMenu: (
    playerId: number,
    triggerButton: HTMLButtonElement | null
  ) => void;
  onSetActionTriggerRef: (
    playerId: number,
    element: HTMLButtonElement | null
  ) => void;
};

export function PlayersTable({
  playersLoading,
  activeOrgId,
  visiblePlayers,
  latestManifestVersion,
  manifestVersionLoading,
  editingPlayerId,
  editName,
  editLocation,
  editDesiredUrl,
  editPowerState,
  editSideKey,
  updatePlayerLoading,
  commandLoading,
  onSetEditName,
  onSetEditLocation,
  onSetEditDesiredUrl,
  onSetEditPowerState,
  onSetEditSideKey,
  onSaveEdit,
  onCancelEdit,
  onUpdateAgent,
  onOpenActionMenu,
  onSetActionTriggerRef,
}: PlayersTableProps) {
  return (
    <div className="flex-1 min-h-0">
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full table-auto">
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
                <th className="hidden xl:table-cell px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
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
                <th className="hidden xl:table-cell px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase">
                  Actions
                  {latestManifestVersion && (
                    <span className="ml-2 hidden xl:inline text-[10px] normal-case text-slate-500">
                      latest {latestManifestVersion}
                    </span>
                  )}
                  {manifestVersionLoading && (
                    <span className="ml-2 hidden xl:inline text-[10px] normal-case text-slate-500">
                      checking...
                    </span>
                  )}
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
              ) : visiblePlayers.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    {activeOrgId
                      ? 'No players found for this filter.'
                      : 'Select an organization to view players.'}
                  </td>
                </tr>
              ) : (
                visiblePlayers.map((player) => (
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
                            onSetEditName(event.target.value)
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
                            onSetEditSideKey(event.target.value as SideKey)
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
                          return (
                            <div className="flex flex-col">
                              <span
                                className={
                                  isOnline ? 'text-green-400' : 'text-slate-500'
                                }
                              >
                                {isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-slate-500">Down (no data)</span>
                      )}
                    </td>
                    <td className="hidden xl:table-cell px-4 py-3 text-sm text-slate-400 max-w-[240px]">
                      {editingPlayerId === player.id ? (
                        <input
                          type="text"
                          value={editLocation}
                          onChange={(event) =>
                            onSetEditLocation(event.target.value)
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
                            onSetEditDesiredUrl(event.target.value)
                          }
                          className="w-full px-2 py-1 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <a
                          href={player.desired_url || undefined}
                          target={player.desired_url ? '_blank' : undefined}
                          rel={
                            player.desired_url
                              ? 'noopener noreferrer'
                              : undefined
                          }
                          title={player.desired_url || undefined}
                          className={
                            player.desired_url
                              ? 'inline-block max-w-full truncate text-indigo-300 hover:text-indigo-200'
                              : 'inline-block max-w-full truncate'
                          }
                        >
                          {getDesiredUrlLabel(player.desired_url)}
                        </a>
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
                            onSetEditPowerState(
                              event.target.value as PowerState
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
                    <td className="hidden xl:table-cell px-4 py-3 text-sm text-slate-400">
                      {format(parseISO(player.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {editingPlayerId === player.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={onSaveEdit}
                            disabled={updatePlayerLoading}
                            className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50"
                          >
                            {updatePlayerLoading ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEdit}
                            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex justify-end">
                          {hasAgentUpdateAvailable(
                            player,
                            latestManifestVersion
                          ) && (
                            <button
                              type="button"
                              onClick={() => onUpdateAgent(player.id)}
                              disabled={
                                commandLoading?.playerId === player.id &&
                                commandLoading?.type === 'agent_update'
                              }
                              className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-700 text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
                              title={`Update available: ${getAgentVersion(player) ?? 'unknown'} -> ${latestManifestVersion}`}
                              aria-label={`Update agent for ${player.name}`}
                            >
                              {commandLoading?.playerId === player.id &&
                              commandLoading?.type === 'agent_update' ? (
                                <span className="text-xs">...</span>
                              ) : (
                                <svg
                                  viewBox="0 0 20 20"
                                  fill="none"
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M10 3v9m0-9l-3 3m3-3l3 3M4 12.5v1A2.5 2.5 0 0 0 6.5 16h7A2.5 2.5 0 0 0 16 13.5v-1"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            ref={(element) =>
                              onSetActionTriggerRef(player.id, element)
                            }
                            onClick={(event) =>
                              onOpenActionMenu(
                                player.id,
                                event.currentTarget as HTMLButtonElement
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
  );
}
