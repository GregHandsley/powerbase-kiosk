import { useState } from 'react';
import { ConfirmationDialog } from '../components/shared/ConfirmationDialog';

export function Home() {
  const [kioskWarning, setKioskWarning] = useState<{
    isOpen: boolean;
    path: string;
    name: string;
    windowName: string;
  }>({ isOpen: false, path: '', name: '', windowName: '' });

  const handleKioskClick = (path: string, name: string, windowName: string) => {
    setKioskWarning({ isOpen: true, path, name, windowName });
  };

  const handleKioskConfirm = () => {
    window.open(
      kioskWarning.path,
      kioskWarning.windowName,
      'noopener,noreferrer,toolbar=0,location=0,menubar=0,status=0,scrollbars=0,resizable=1,width=1600,height=900'
    );
    setKioskWarning({ isOpen: false, path: '', name: '', windowName: '' });
  };

  const handleKioskCancel = () => {
    setKioskWarning({ isOpen: false, path: '', name: '', windowName: '' });
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
      <div className="max-w-lg text-center px-4 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold mb-2">
            Powerbase Kiosk – Dev Home
          </h1>
          <p className="text-slate-300 text-sm">
            Use the buttons below to open kiosk views in a new window without
            browser chrome.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() =>
              handleKioskClick('/kiosk/power', 'Kiosk Power', 'kiosk-power')
            }
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Open Power Kiosk
          </button>
          <button
            type="button"
            onClick={() =>
              handleKioskClick('/kiosk/base', 'Kiosk Base', 'kiosk-base')
            }
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            Open Base Kiosk
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Note: Pop-up blockers may need to allow this site. In production,
          point TVs directly to the kiosk URLs.
        </p>
      </div>

      {/* Kiosk Warning Dialog */}
      <ConfirmationDialog
        isOpen={kioskWarning.isOpen}
        title={`Open ${kioskWarning.name}?`}
        message="This will open a kiosk view intended for display on facility screens. This view is read-only and cannot be interacted with. This is for development purposes. This view will change for production, but functionality will remain the same."
        confirmLabel="Open Kiosk"
        cancelLabel="Cancel"
        onConfirm={handleKioskConfirm}
        onCancel={handleKioskCancel}
        confirmVariant="primary"
      />
    </div>
  );
}
