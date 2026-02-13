import { useMemo, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const AGENT_STATUS_URL = 'http://127.0.0.1:38473';

export function KioskUnpaired() {
  const [searchParams] = useSearchParams();
  const urlCode = useMemo(
    () => searchParams.get('code')?.trim() || null,
    [searchParams]
  );

  const [fetchedCode, setFetchedCode] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('kiosk-mode');
    return () => {
      document.body.classList.remove('kiosk-mode');
    };
  }, []);

  useEffect(() => {
    if (urlCode) return;
    const load = async () => {
      try {
        const res = await fetch(`${AGENT_STATUS_URL}/status`);
        if (res.ok) {
          const data = (await res.json()) as { code?: string };
          setFetchedCode(data.code ?? null);
        }
      } catch {
        setFetchedCode(null);
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [urlCode]);

  const code = urlCode ?? fetchedCode ?? null;

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center px-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-2xl font-semibold">Pair this device</h1>
        <p className="text-slate-300 text-sm">
          Enter the code below in Admin → Players to connect this kiosk.
        </p>

        <div className="bg-slate-900/80 border-2 border-indigo-500/50 rounded-xl px-10 py-8">
          <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">
            Pairing code
          </div>
          <div className="font-mono text-4xl tracking-[0.3em] text-indigo-300">
            {code ?? '—'}
          </div>
        </div>

        <div className="text-sm text-slate-400">
          <p>1. Open Admin → Players</p>
          <p>2. Create or select a Player</p>
          <p>3. Enter the code above and click Pair</p>
        </div>

        {!code && (
          <p className="text-amber-400 text-sm">
            Waiting for agent… If this persists, restart the kiosk or check that
            the agent is running.
          </p>
        )}
      </div>
    </div>
  );
}
