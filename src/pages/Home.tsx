export function Home() {
  const openKiosk = (path: string, name: string) => {
    window.open(
      path,
      name,
      "noopener,noreferrer,toolbar=0,location=0,menubar=0,status=0,scrollbars=0,resizable=1,width=1600,height=900"
    );
  };

    return (
      <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
      <div className="max-w-lg text-center px-4 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Powerbase Kiosk – Dev Home</h1>
          <p className="text-slate-300 text-sm">
            Use the buttons below to open kiosk views in a new window without browser chrome.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => openKiosk("/kiosk/power", "kiosk-power")}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Open Power Kiosk
          </button>
          <button
            type="button"
            onClick={() => openKiosk("/kiosk/base", "kiosk-base")}
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            Open Base Kiosk
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Note: Pop-up blockers may need to allow this site. In production, point TVs directly to
          the kiosk URLs.
          </p>
        </div>
      </div>
    );
  }