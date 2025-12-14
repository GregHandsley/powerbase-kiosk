import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 20_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 3,
      staleTime: 10_000,
    },
  },
});

// Export for fast refresh so the module has an export.
export function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-red-400">
      <div className="max-w-md text-center px-4">
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm opacity-80">
          The kiosk/admin app hit an error. Please refresh the page. If this
          persists, contact the system admin.
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
          <div className="app-shell">
            <App />
          </div>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
