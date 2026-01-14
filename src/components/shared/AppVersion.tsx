// src/components/shared/AppVersion.tsx
import { APP_VERSION } from '../../config/env';

export function AppVersion() {
  return (
    <small className="text-xs text-slate-500 font-mono">v{APP_VERSION}</small>
  );
}
