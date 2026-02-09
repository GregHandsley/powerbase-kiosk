// Shared types for Player Agent API (UI side)
// Keep in sync with supabase/functions/_shared/playerAgentTypes.ts

export type PlayerPowerState = 'on' | 'off';

export type PlayerCommandType =
  | 'set_url'
  | 'reload'
  | 'reboot'
  | 'restart_kiosk'
  | 'display_on'
  | 'display_off';

export type PlayerCommandStatus = 'queued' | 'running' | 'success' | 'fail';

export type PlayerLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type DeviceMetadata = {
  hostname?: string;
  ip?: string;
  model?: string;
  temp_c?: number;
  [key: string]: unknown;
};

export type PairRequest = {
  code: string;
  device_id: string;
  meta?: DeviceMetadata;
};

export type PairResponse = {
  player_id: number;
  device_token: string;
};

export type HeartbeatRequest = {
  device_id: string;
  device_token: string;
  meta?: DeviceMetadata;
};

export type HeartbeatResponse = {
  ok: true;
  player_id: number;
};

export type PlayerConfigRequest = {
  device_id: string;
  device_token: string;
};

export type PlayerConfigResponse = {
  ok: true;
  player_id: number;
  desired_url: string | null;
};

export type CommandPayload = Record<string, unknown>;

export type PlayerCommand = {
  id: number;
  player_id: number;
  type: PlayerCommandType;
  payload: CommandPayload;
  status: PlayerCommandStatus;
  created_at: string;
  ack_at?: string | null;
  error?: string | null;
};

export type CommandsResponse = {
  commands: PlayerCommand[];
};

export type CommandAckRequest = {
  command_id: number;
  device_id: string;
  device_token: string;
  status: 'success' | 'fail';
  error?: string | null;
};

export type CommandAckResponse = {
  ok: true;
};

export type LogRequest = {
  device_id: string;
  device_token: string;
  level: PlayerLogLevel;
  message: string;
  meta?: Record<string, unknown>;
};

export type LogResponse = {
  ok: true;
};
