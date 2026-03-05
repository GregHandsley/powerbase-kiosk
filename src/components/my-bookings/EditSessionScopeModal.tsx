/**
 * When editing a block booking from My Bookings: choose whether to edit
 * one session (pick date) or all sessions before opening the edit modal.
 */

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal } from '../shared/Modal';
import type { BookingWithInstances } from '../../hooks/useMyBookings';

type Props = {
  booking: BookingWithInstances;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (instanceIds: number[]) => void;
};

export function EditSessionScopeModal({
  booking,
  isOpen,
  onClose,
  onConfirm,
}: Props) {
  const [mode, setMode] = useState<'one' | 'all'>('one');
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(
    () => booking.instances[0]?.id ?? null
  );

  const sortedInstances = [...booking.instances].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const handleConfirm = () => {
    if (mode === 'all') {
      onConfirm(sortedInstances.map((i) => i.id));
    } else if (selectedInstanceId) {
      onConfirm([selectedInstanceId]);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={onClose} maxWidth="sm" lockScroll>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Edit which sessions?
        </h2>
        <p className="text-sm text-slate-400">
          This booking has {booking.instances.length} session
          {booking.instances.length !== 1 ? 's' : ''}. Choose what to edit.
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="editScope"
              checked={mode === 'one'}
              onChange={() => setMode('one')}
              className="rounded-full border-slate-600 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-slate-200">One session</span>
          </label>
          {mode === 'one' && (
            <div className="ml-6 pr-4">
              <select
                value={selectedInstanceId ?? ''}
                onChange={(e) =>
                  setSelectedInstanceId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {sortedInstances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {format(parseISO(inst.start), 'EEE d MMM yyyy')} —{' '}
                    {format(parseISO(inst.start), 'HH:mm')}–
                    {format(parseISO(inst.end), 'HH:mm')}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="editScope"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
              className="rounded-full border-slate-600 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-slate-200">
              All {booking.instances.length} sessions
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={mode === 'one' && !selectedInstanceId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </Modal>
  );
}
