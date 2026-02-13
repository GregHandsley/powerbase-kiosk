import type { PlayerListItem } from './types';

export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export function formatUptime(uptimeSeconds: number): string {
  const total = Math.max(0, Math.floor(uptimeSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}m`;
}

export function formatElapsedFrom(date: Date): string {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );
  return formatUptime(elapsedSeconds);
}

export function getMetaNumber(
  meta: Record<string, unknown> | null | undefined,
  key: string
): number | null {
  const value = meta?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeRange(
  value: number | null,
  min: number,
  max: number
): number | null {
  if (value == null) return null;
  const percent = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, percent));
}

export function getDesiredUrlLabel(desiredUrl: string | null): string {
  if (!desiredUrl) return '—';
  try {
    const parsed = new URL(desiredUrl);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    const compact = `${parsed.hostname}${path}`;
    if (compact.length <= 48) {
      return compact;
    }
    return `${compact.slice(0, 45)}...`;
  } catch {
    return desiredUrl.length <= 48
      ? desiredUrl
      : `${desiredUrl.slice(0, 45)}...`;
  }
}

export function getAgentVersion(player: PlayerListItem): string | null {
  const meta = player.device_meta as Record<string, unknown> | null;
  const version =
    meta && typeof meta.agent_version === 'string'
      ? meta.agent_version.trim()
      : '';
  return version || null;
}

export function hasAgentUpdateAvailable(
  player: PlayerListItem,
  latestManifestVersion: string | null
): boolean {
  if (!latestManifestVersion) return false;
  const currentVersion = getAgentVersion(player) ?? '';
  if (!currentVersion) return false;
  return currentVersion !== latestManifestVersion;
}
