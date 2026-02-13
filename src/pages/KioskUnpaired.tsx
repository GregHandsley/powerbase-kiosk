import { useMemo, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const AGENT_STATUS_URL = 'http://127.0.0.1:38473';

export function KioskUnpaired() {
  const [searchParams] = useSearchParams();
  const urlDeviceId = useMemo(
    () => searchParams.get('device_id')?.trim() || null,
    [searchParams]
  );
  const urlCode = useMemo(
    () => searchParams.get('code')?.trim() || null,
    [searchParams]
  );

  const [fetched, setFetched] = useState<{
    device_id: string | null;
    code: string | null;
  } | null>(null);

  useEffect(() => {
    if (urlDeviceId && urlCode) return;
    const load = async () => {
      try {
        const res = await fetch(`${AGENT_STATUS_URL}/status`);
        if (res.ok) {
          const data = (await res.json()) as {
            device_id?: string;
            code?: string;
          };
          setFetched({
            device_id: data.device_id ?? null,
            code: data.code ?? null,
          });
        }
      } catch {
        setFetched({ device_id: null, code: null });
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [urlDeviceId, urlCode]);

  const deviceId = urlDeviceId ?? fetched?.device_id ?? null;
  const code = urlCode ?? fetched?.code ?? null;

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

        {(!deviceId || !code) && (
          <p className="text-amber-400 text-sm">
            Waiting for agent… If this persists, restart the kiosk or check that
            the agent is running.
          </p>
        )}
        {deviceId && (
          <div className="text-xs text-slate-500 font-mono break-all">
            Device: {deviceId}
          </div>
        )}
      </div>
    </div>
  );
}
