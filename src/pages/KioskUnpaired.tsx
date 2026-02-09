import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function KioskUnpaired() {
  const [searchParams] = useSearchParams();
  const deviceId = useMemo(
    () => searchParams.get('device_id')?.trim() || null,
    [searchParams]
  );

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center px-8">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-2xl font-semibold">Device not paired</h1>
        <p className="text-slate-300 text-sm">
          This kiosk is online but not yet linked to a Player. Use the device ID
          below to generate a pairing code in the admin UI.
        </p>
        <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-6 py-4">
          <div className="text-xs uppercase tracking-widest text-slate-400">
            Device ID
          </div>
          <div className="mt-2 font-mono text-lg break-all">
            {deviceId ?? 'Unavailable'}
          </div>
        </div>
        <div className="text-left text-sm text-slate-300 space-y-2">
          <div className="font-semibold text-slate-100">Pairing steps</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open Admin → Players.</li>
            <li>Create or select a Player and click “Generate code”.</li>
            <li>Run the pairing command on this Pi:</li>
          </ol>
          <pre className="mt-2 text-xs bg-slate-900/80 rounded-lg px-4 py-3 overflow-auto">
            <code>
              SUPABASE_URL="https://&lt;project-ref&gt;.supabase.co" \
              SUPABASE_ANON_KEY="&lt;anon-key&gt;" \ ./agent.py pair
              &lt;PAIRING_CODE&gt;
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
