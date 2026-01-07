import { useEffect, useState } from "react";
import type { FallbackProps } from "react-error-boundary";
import * as Sentry from "@sentry/react";

export function KioskErrorScreen({ error, resetErrorBoundary }: FallbackProps) {
  const [seconds, setSeconds] = useState(5);

  // Send error to Sentry
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        errorType: "kiosk-error",
        errorBoundary: "kiosk",
      },
      extra: {
        errorMessage: error.message,
        errorStack: error.stack,
      },
    });
  }, [error]);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          resetErrorBoundary();
          return 5;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resetErrorBoundary]);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center gap-3 px-6">
      <div className="text-xl font-semibold">Something went wrong</div>
      <div className="text-sm text-slate-300 max-w-md text-center">
        The kiosk display hit an error. It will automatically try to recover in a few seconds. If
        this persists, please contact the Powerbase team.
      </div>
      <div className="text-xs text-slate-400">Retrying in {seconds}…</div>
      <pre className="mt-4 text-[10px] text-slate-500 max-w-lg overflow-auto bg-slate-900/80 rounded px-3 py-2">
        {error.message}
      </pre>
    </div>
  );
}

