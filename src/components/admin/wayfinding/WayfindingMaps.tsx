import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

type MapEntry = {
  id: string;
  label: string;
  path: string;
};

const MAP_ENTRIES: MapEntry[] = [
  {
    id: 'wayfinding-base',
    label: 'Wayfinding (Base)',
    path: '/kiosk/wayfinding?side=Base',
  },
  {
    id: 'wayfinding-power',
    label: 'Wayfinding (Power)',
    path: '/kiosk/wayfinding?side=Power',
  },
  {
    id: 'wayfinding-static-base',
    label: 'Wayfinding Static (Base)',
    path: '/kiosk/wayfinding-static?side=Base',
  },
  {
    id: 'wayfinding-static-power',
    label: 'Wayfinding Static (Power)',
    path: '/kiosk/wayfinding-static?side=Power',
  },
];

export function WayfindingMaps() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://app.local';

  const rows = useMemo(
    () =>
      MAP_ENTRIES.map((entry) => ({
        ...entry,
        fullUrl: `${baseUrl}${entry.path}`,
      })),
    [baseUrl]
  );

  const copyUrl = async (id: string, fullUrl: string) => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(id);
      toast.success('Wayfinding URL copied');
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <h3 className="text-base font-semibold text-slate-100">
          Wayfinding Maps
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Copy URLs for screen setup. These tools are admin-only and not shown
          on the public home page.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid gap-2 rounded-md border border-slate-700 bg-slate-900/40 p-3 md:grid-cols-[220px_minmax(0,1fr)_auto]"
          >
            <div className="text-sm font-medium text-slate-200">
              {row.label}
            </div>
            <code className="overflow-x-auto rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-300">
              {row.fullUrl}
            </code>
            <button
              type="button"
              onClick={() => void copyUrl(row.id, row.fullUrl)}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-1 text-xs text-slate-100 hover:bg-slate-800"
            >
              {copiedId === row.id ? 'Copied' : 'Copy URL'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
