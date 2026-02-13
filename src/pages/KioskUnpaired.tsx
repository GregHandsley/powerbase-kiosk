import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const AGENT_PAIRING_URL = 'http://127.0.0.1:38473';

export function KioskUnpaired() {
  const [searchParams] = useSearchParams();
  const deviceId = useMemo(
    () => searchParams.get('device_id')?.trim() || null,
    [searchParams]
  );
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch(`${AGENT_PAIRING_URL}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        setStatus('success');
        setMessage('Paired successfully. Restarting...');
      } else {
        setStatus('error');
        setMessage(data.error || 'Pairing failed');
      }
    } catch {
      setStatus('error');
      setMessage('Could not reach agent. Is it running?');
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center px-8">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-2xl font-semibold">Pair this device</h1>
        <p className="text-slate-300 text-sm">
          Enter the pairing code from Admin → Players to link this kiosk to a
          Player.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC12345"
            className="w-full max-w-xs mx-auto px-4 py-3 text-center font-mono text-lg bg-slate-900 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            maxLength={12}
            autoFocus
            disabled={status === 'loading'}
          />
          <button
            type="submit"
            disabled={!code.trim() || status === 'loading'}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium"
          >
            {status === 'loading' ? 'Pairing...' : 'Pair'}
          </button>
        </form>

        {message && (
          <p
            className={
              status === 'success'
                ? 'text-green-400 text-sm'
                : status === 'error'
                  ? 'text-red-400 text-sm'
                  : 'text-slate-400 text-sm'
            }
          >
            {message}
          </p>
        )}

        <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-6 py-4 mt-4">
          <div className="text-xs uppercase tracking-widest text-slate-400">
            Device ID
          </div>
          <div className="mt-2 font-mono text-sm break-all text-slate-300">
            {deviceId ?? 'Unavailable'}
          </div>
        </div>

        <div className="text-left text-sm text-slate-400 space-y-1">
          <div className="font-semibold text-slate-300">Steps</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open Admin → Players.</li>
            <li>
              Create or select a Player and click &quot;Generate code&quot;.
            </li>
            <li>Enter the code above and click Pair.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
