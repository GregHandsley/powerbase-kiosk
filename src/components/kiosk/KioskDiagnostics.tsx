import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

type FpsPreset = 'off' | '2-3' | '4' | '5-6' | '8-10' | 'smooth';

const FPS_PRESETS: Record<FpsPreset, { label: string; steps: number }> = {
  off: { label: 'Off (Smooth)', steps: 0 },
  '2-3': { label: '2-3 FPS', steps: 1 },
  '4': { label: '4 FPS', steps: 2 },
  '5-6': { label: '5-6 FPS', steps: 3 },
  '8-10': { label: '8-10 FPS', steps: 4 },
  smooth: { label: 'Smooth (60 FPS)', steps: 0 },
};

export function KioskDiagnostics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const debug =
    searchParams.get('debug') === 'true' || searchParams.get('fps') !== null;
  const streamPreview = searchParams.get('streamPreview') === 'true';

  // Get FPS preset from URL or default
  const fpsParam = searchParams.get('fps') as FpsPreset | null;
  const [fpsPreset, setFpsPreset] = useState<FpsPreset>(
    fpsParam && fpsParam in FPS_PRESETS
      ? fpsParam
      : streamPreview
        ? '2-3'
        : 'off'
  );

  // Apply FPS settings to CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    const preset = FPS_PRESETS[fpsPreset];

    if (preset.steps === 0) {
      // Smooth mode - remove stepped transitions
      root.style.setProperty('--fps-steps-fade', '1');
      root.style.setProperty('--fps-steps-quadrant', '1');
      root.style.setProperty('--fps-steps-card', '1');
      root.style.setProperty('--fps-steps-icon', '0'); // 0 = smooth
    } else {
      // Stepped mode
      root.style.setProperty('--fps-steps-fade', String(preset.steps));
      root.style.setProperty('--fps-steps-quadrant', String(preset.steps));
      root.style.setProperty('--fps-steps-card', String(preset.steps));
      root.style.setProperty('--fps-steps-icon', String(preset.steps));
    }

    // Update URL param
    const params = new URLSearchParams(searchParams);
    if (fpsPreset === 'off' || fpsPreset === 'smooth') {
      params.delete('fps');
    } else {
      params.set('fps', fpsPreset);
    }
    setSearchParams(params, { replace: true });
  }, [fpsPreset, searchParams, setSearchParams]);

  // Toggle stream preview mode based on FPS
  useEffect(() => {
    if (fpsPreset !== 'off' && fpsPreset !== 'smooth') {
      document.body.classList.add('stream-preview-mode');
    } else {
      document.body.classList.remove('stream-preview-mode');
    }
  }, [fpsPreset]);

  if (!debug) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-slate-900/95 border border-slate-700 rounded-lg p-4 shadow-xl backdrop-blur-sm">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            Kiosk Diagnostics
          </h3>
          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.delete('debug');
              setSearchParams(params, { replace: true });
            }}
            className="text-slate-400 hover:text-slate-200 text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-300 block">FPS Simulation</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(FPS_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => setFpsPreset(key as FpsPreset)}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  fpsPreset === key
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-700">
          <div className="text-xs text-slate-400 space-y-1">
            <div>Current: {FPS_PRESETS[fpsPreset].label}</div>
            <div>Steps: {FPS_PRESETS[fpsPreset].steps || 'Smooth'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
