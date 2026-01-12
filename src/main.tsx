import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';
import * as Sentry from '@sentry/react';
import App from './App';
import './styles/index.css';
import { AuthProvider } from './context/AuthContext';
import { initSentry, captureQueryError } from './lib/sentry';

// Initialize Sentry as early as possible
initSentry();

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: Error, query) => {
      // Track React Query errors in Sentry
      const key = query.queryKey ? [...query.queryKey] : [];
      captureQueryError(error, key, {
        queryState: query.state,
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: Error, _variables, _context, mutation) => {
      // Track mutation errors in Sentry
      // In React Query v5, mutation options are accessed via mutation.options
      const key = mutation.options?.mutationKey
        ? [...mutation.options.mutationKey]
        : [];
      captureQueryError(error, key, {
        variables: _variables,
        context: _context,
      });
    },
  }),
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
export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  // Send error to Sentry
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-red-400">
      <div className="max-w-md text-center px-4">
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm opacity-80">
          The kiosk/admin app hit an error. Please refresh the page. If this
          persists, contact the system admin.
        </p>
        <button
          onClick={resetErrorBoundary}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

// Wrapper for Sentry ErrorBoundary that matches its expected signature
function SentryErrorFallback({
  error,
  resetError,
}: {
  error: unknown;
  resetError: () => void;
}) {
  return <ErrorFallback error={error} resetErrorBoundary={resetError} />;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={SentryErrorFallback} showDialog={false}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <div className="app-shell">
                <App />
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#1e293b',
                      color: '#e2e8f0',
                      border: '1px solid #334155',
                    },
                    success: {
                      iconTheme: {
                        primary: '#10b981',
                        secondary: '#e2e8f0',
                      },
                    },
                    error: {
                      iconTheme: {
                        primary: '#ef4444',
                        secondary: '#e2e8f0',
                      },
                    },
                  }}
                />
              </div>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
