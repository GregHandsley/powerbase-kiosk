import type { Player } from '../../../../hooks/usePlayers';

export type PlayerListItem = Player;

export type SideKey = 'Base' | 'Power';

export type PowerState = 'on' | 'off';

export type CommandLoadingState = {
  playerId: number;
  type: string;
} | null;

export type MenuPosition = {
  top: number;
  left: number;
};

export type MenuPlacement = 'above' | 'below';
