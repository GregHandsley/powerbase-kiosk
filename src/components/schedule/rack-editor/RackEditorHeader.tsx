type Props = {
  saving: boolean;
  savedAt: Date | null;
  onSave: () => void;
};

export function RackEditorHeader({ saving, savedAt, onSave }: Props) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">
          Rack assignments
        </h2>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
      {savedAt && !saving && (
        <div className="text-[11px] text-emerald-400">
          Saved at{' '}
          {savedAt.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </div>
      )}
    </>
  );
}
