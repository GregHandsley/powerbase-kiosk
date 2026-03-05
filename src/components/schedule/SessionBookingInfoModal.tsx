/**
 * Read-only modal for Session View: shows booking details including
 * platforms/racks and areas with their time slots (parallel or sequential).
 */

import type { ActiveInstance } from '../../types/snapshot';
import { Modal } from '../shared/Modal';
import { areaKeyToLabel } from './utils/areaKeyUtils';
import { getRackOrPlatformLabel } from './utils/platformUtils';

type Props = {
  booking: ActiveInstance | null;
  side: 'power' | 'base';
  isOpen: boolean;
  onClose: () => void;
};

function timeLabel(s: string): string {
  return s.includes('T') ? s.slice(11, 16) : s;
}

export function SessionBookingInfoModal({
  booking,
  side,
  isOpen,
  onClose,
}: Props) {
  if (!booking) return null;

  const slots = booking.area_slots ?? [];
  const rackSlots = slots.filter((s) => s.area_key.startsWith('rack_'));
  const areaSlots = slots.filter((s) => !s.area_key.startsWith('rack_'));

  // Racks with no specific slot use instance start/end
  const rackNumbers = [...new Set(booking.racks)].sort((a, b) => a - b);
  const rackRows = rackNumbers.map((rackNum) => {
    const rackKey = `rack_${rackNum}`;
    const slot = rackSlots.find((s) => s.area_key === rackKey);
    return {
      label: getRackOrPlatformLabel(side, rackNum),
      start: slot?.start ?? booking.start,
      end: slot?.end ?? booking.end,
    };
  });

  const areaRows = areaSlots.map((slot) => ({
    label: areaKeyToLabel(slot.area_key),
    start: slot.start,
    end: slot.end,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md" lockScroll>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {booking.title}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {timeLabel(booking.start)} – {timeLabel(booking.end)}
              {booking.racks.length === 0 &&
                areaRows.length === 0 &&
                ' (full window)'}
            </p>
          </div>
          {booking.isLocked && (
            <span className="shrink-0 px-2 py-1 text-xs rounded bg-slate-700/60 text-slate-300 border border-slate-600/50">
              Locked
            </span>
          )}
        </div>

        {booking.capacity != null && (
          <p className="text-sm text-slate-300">
            <span className="text-slate-500">Capacity:</span> {booking.capacity}{' '}
            athlete{booking.capacity !== 1 ? 's' : ''}
          </p>
        )}

        {rackRows.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Platforms / Racks
            </h3>
            <ul className="space-y-2">
              {rackRows.map((row, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-4 py-2 px-3 rounded-md bg-slate-800/60 border border-slate-700/80 text-sm"
                >
                  <span className="text-slate-200 font-medium">
                    {row.label}
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    {timeLabel(row.start)} – {timeLabel(row.end)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {areaRows.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Areas
            </h3>
            <ul className="space-y-2">
              {areaRows.map((row, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-4 py-2 px-3 rounded-md bg-slate-800/60 border border-slate-700/80 text-sm"
                >
                  <span className="text-slate-200 font-medium">
                    {row.label}
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    {timeLabel(row.start)} – {timeLabel(row.end)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rackRows.length === 0 &&
          areaRows.length === 0 &&
          booking.racks.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Platforms / Racks
              </h3>
              <p className="text-sm text-slate-400">
                {rackNumbers
                  .map((n) => getRackOrPlatformLabel(side, n))
                  .join(', ')}{' '}
                — {timeLabel(booking.start)} – {timeLabel(booking.end)}
              </p>
            </div>
          )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
