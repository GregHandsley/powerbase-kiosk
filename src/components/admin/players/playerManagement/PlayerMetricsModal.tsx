import { format, parseISO } from 'date-fns';
import type { CommandLoadingState, PlayerListItem } from './types';
import {
  formatUptime,
  getAgentVersion,
  getMetaNumber,
  hasAgentUpdateAvailable,
  normalizeRange,
} from './utils';

type PlayerMetricsModalProps = {
  player: PlayerListItem | null;
  commandLoading: CommandLoadingState;
  latestManifestVersion: string | null;
  onClose: () => void;
  onUpdateAgent: (playerId: number) => void;
};

export function PlayerMetricsModal({
  player,
  commandLoading,
  latestManifestVersion,
  onClose,
  onUpdateAgent,
}: PlayerMetricsModalProps) {
  if (!player) return null;

  const meta = player.device_meta as Record<string, unknown> | null;
  const cpu = getMetaNumber(meta, 'cpu_percent');
  const memory = getMetaNumber(meta, 'memory_percent');
  const temperature = getMetaNumber(meta, 'temp_c');
  const uptimeSeconds = getMetaNumber(meta, 'uptime_seconds');
  const chromiumRunning =
    meta && typeof meta.chromium_running === 'boolean'
      ? meta.chromium_running
      : null;
  const updateStatus =
    meta && typeof meta.agent_update_status === 'string'
      ? meta.agent_update_status
      : null;
  const cpuPercent = normalizeRange(cpu, 0, 100);
  const memoryPercent = normalizeRange(memory, 0, 100);
  const tempPercent = normalizeRange(temperature, 20, 90);
  const lastSeen = player.last_seen_at ? parseISO(player.last_seen_at) : null;
  const canUpdate = hasAgentUpdateAvailable(player, latestManifestVersion);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              {player.name} metrics
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {lastSeen
                ? `Last heartbeat ${format(lastSeen, 'MMM d, yyyy HH:mm')}`
                : 'No heartbeat data yet'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            {
              label: 'CPU load',
              value: cpu,
              marker: cpuPercent,
              unit: '%',
              low: '0%',
              high: '100%',
            },
            {
              label: 'Memory use',
              value: memory,
              marker: memoryPercent,
              unit: '%',
              low: '0%',
              high: '100%',
            },
            {
              label: 'Temperature',
              value: temperature,
              marker: tempPercent,
              unit: 'C',
              low: '20C',
              high: '90C',
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-slate-700 bg-slate-800/70 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">{metric.label}</span>
                <span className="text-sm font-semibold text-slate-100">
                  {metric.value == null
                    ? '--'
                    : `${Math.round(metric.value)}${metric.unit}`}
                </span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 relative overflow-hidden">
                {metric.marker != null && (
                  <span
                    className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
                    style={{ left: `${metric.marker}%` }}
                  />
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>{metric.low}</span>
                <span>{metric.high}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
            <div className="text-xs text-slate-400">Uptime</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">
              {uptimeSeconds == null ? '--' : formatUptime(uptimeSeconds)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
            <div className="text-xs text-slate-400">Chromium</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">
              {chromiumRunning == null
                ? '--'
                : chromiumRunning
                  ? 'Running'
                  : 'Stopped'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
            <div className="text-xs text-slate-400">Agent version</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">
              {getAgentVersion(player) ?? 'Unknown'}
            </div>
            {updateStatus && (
              <div className="mt-1 text-[11px] text-slate-400">
                Update status: {updateStatus}
              </div>
            )}
          </div>
        </div>

        {canUpdate && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => onUpdateAgent(player.id)}
              disabled={commandLoading?.playerId === player.id}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Queue update
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
