import { useState, type FormEvent } from 'react';
import { ModalPortal } from '../../../shared/ModalPortal';

type PairDeviceModalProps = {
  isOpen: boolean;
  playerName: string;
  playerId: number;
  loading: boolean;
  onClose: () => void;
  onPair: (playerId: number, code: string) => Promise<void>;
};

export function PairDeviceModal({
  isOpen,
  playerName,
  playerId,
  loading,
  onClose,
  onPair,
}: PairDeviceModalProps) {
  const [code, setCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      await onPair(playerId, trimmed);
      setCode('');
      onClose();
    } catch {
      // Error is handled by caller (toast)
    }
  };

  return (
    <ModalPortal lockScroll>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
        <div className="absolute inset-0" onClick={onClose} aria-hidden />
        <div
          className="relative z-10 w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl"
          role="dialog"
          aria-labelledby="pair-device-title"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3
              id="pair-device-title"
              className="text-sm font-semibold text-slate-200"
            >
              Pair device to {playerName}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>
          <p className="mb-4 text-xs text-slate-400">
            Enter the pairing code shown on the kiosk screen (e.g. ABC-DEF-GHI).
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-300 mb-1.5">
                Pairing code
              </span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABC-DEF-GHI"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-sm text-slate-100 font-mono tracking-wider placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
                disabled={loading}
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
              >
                {loading ? 'Pairing...' : 'Pair'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
