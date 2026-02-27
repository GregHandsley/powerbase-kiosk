import type { MutableRefObject } from 'react';
import type {
  CommandLoadingState,
  MenuPlacement,
  MenuPosition,
  PlayerListItem,
} from './types';

type PlayerActionMenuProps = {
  isOpen: boolean;
  position: MenuPosition | null;
  placement: MenuPlacement;
  activePlayer: PlayerListItem | null;
  actionMenuRef: MutableRefObject<HTMLDivElement | null>;
  commandLoading: CommandLoadingState;
  deletingPlayerId: number | null;
  deletePlayerLoading: boolean;
  canUpdateAgent: (player: PlayerListItem) => boolean;
  onClose: () => void;
  onStartEdit: (player: PlayerListItem) => void;
  onOpenMetrics: (playerId: number) => void;
  onSendCommand: (playerId: number, type: string) => void;
  onUpdateAgent: (playerId: number) => void;
  onDeletePlayer: (playerId: number, playerName: string) => void;
  onOpenPairModal: (player: PlayerListItem) => void;
};

export function PlayerActionMenu({
  isOpen,
  position,
  placement,
  activePlayer,
  actionMenuRef,
  commandLoading,
  deletingPlayerId,
  deletePlayerLoading,
  canUpdateAgent,
  onClose,
  onStartEdit,
  onOpenMetrics,
  onSendCommand,
  onUpdateAgent,
  onDeletePlayer,
  onOpenPairModal,
}: PlayerActionMenuProps) {
  if (!isOpen || !position || !activePlayer) return null;

  return (
    <div
      ref={actionMenuRef}
      className="fixed z-50 w-52 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl"
      style={{ top: position.top, left: position.left }}
    >
      <div
        className={`absolute h-2 w-2 rotate-45 bg-slate-900 ${
          placement === 'below'
            ? '-top-1 right-4 border-l border-t border-slate-700'
            : '-bottom-1 right-4 border-r border-b border-slate-700'
        }`}
      />
      <button
        type="button"
        onClick={() => {
          onStartEdit(activePlayer);
          onClose();
        }}
        className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
      >
        Edit player
      </button>
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenMetrics(activePlayer.id);
        }}
        className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
      >
        View metrics
      </button>
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenPairModal(activePlayer);
        }}
        className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
      >
        Pair device
      </button>
      <button
        type="button"
        onClick={() => {
          onClose();
          onSendCommand(activePlayer.id, 'display_on');
        }}
        disabled={commandLoading?.playerId === activePlayer.id}
        className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
      >
        Display on
      </button>
      <button
        type="button"
        onClick={() => {
          onClose();
          onSendCommand(activePlayer.id, 'display_off');
        }}
        disabled={commandLoading?.playerId === activePlayer.id}
        className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
      >
        Display off
      </button>
      <button
        type="button"
        onClick={() => {
          onClose();
          onSendCommand(activePlayer.id, 'reload');
        }}
        disabled={commandLoading?.playerId === activePlayer.id}
        className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
      >
        Reload
      </button>
      <button
        type="button"
        onClick={() => {
          onClose();
          onSendCommand(activePlayer.id, 'restart_kiosk');
        }}
        disabled={commandLoading?.playerId === activePlayer.id}
        className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
      >
        Restart kiosk
      </button>
      {canUpdateAgent(activePlayer) && (
        <button
          type="button"
          onClick={() => onUpdateAgent(activePlayer.id)}
          disabled={commandLoading?.playerId === activePlayer.id}
          className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Update agent
        </button>
      )}
      <div className="my-1 border-t border-slate-700" />
      <button
        type="button"
        onClick={() => onDeletePlayer(activePlayer.id, activePlayer.name)}
        disabled={deletingPlayerId === activePlayer.id || deletePlayerLoading}
        className="w-full rounded px-2 py-1.5 text-left text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
      >
        {deletingPlayerId === activePlayer.id ? 'Deleting...' : 'Delete player'}
      </button>
    </div>
  );
}
