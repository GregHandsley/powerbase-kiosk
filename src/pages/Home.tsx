export function Home() {
    return (
      <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center">
        <div className="max-w-lg text-center px-4">
          <h1 className="text-2xl font-semibold mb-2">
            Powerbase Kiosk – Dev Home
          </h1>
          <p className="text-slate-300 text-sm mb-4">
            Use the navigation above to open kiosk views or the admin dashboard.
            In production, TVs will point directly at the kiosk routes.
          </p>
        </div>
      </div>
    );
  }
  