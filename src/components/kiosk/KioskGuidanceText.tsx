/**
 * Optional guidance text panel for bottom-left of kiosk.
 *
 * Purpose: Provide static, non-dominant help text
 *
 * Rules:
 * - Small
 * - Static
 * - Non-dominant
 * - Never required to read to use the system
 */
export function KioskGuidanceText() {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded p-3 space-y-1 text-xs text-slate-400">
      <div>NOW = current session</div>
      <div>NEXT = upcoming session (you may be early)</div>
      <div>Platform details rotate every few seconds</div>
    </div>
  );
}
