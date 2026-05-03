import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorDetails = this.state.error?.message;
      let isOfflineError = false;
      
      try {
        if (errorDetails && errorDetails.startsWith('{')) {
          const parsed = JSON.parse(errorDetails);
          if (parsed.error && parsed.error.includes('offline')) {
            isOfflineError = true;
          }
          errorDetails = JSON.stringify(parsed, null, 2);
        } else if (errorDetails && errorDetails.includes('offline')) {
          isOfflineError = true;
        }
      } catch (e) {
        // Not JSON
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4 transition-colors">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg max-w-2xl w-full transition-colors">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              {isOfflineError ? 'Database Connection Error' : 'Something went wrong'}
            </h2>
            
            {isOfflineError && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800/50">
                <h3 className="font-bold mb-2">Firestore Database Not Found</h3>
                <p className="mb-2">It looks like the Firestore database hasn't been created in your Firebase project yet.</p>
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  <li>Go to the <a href={`https://console.firebase.google.com/`} target="_blank" rel="noreferrer" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">Firebase Console</a></li>
                  <li>Open your project</li>
                  <li>Click on <strong>Firestore Database</strong> in the left sidebar</li>
                  <li>Click <strong>Create database</strong> (start in Production mode)</li>
                  <li>Once created, reload this page.</li>
                </ol>
              </div>
            )}

            <div className="bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-4 rounded-lg overflow-auto max-h-96">
              <pre className="text-sm whitespace-pre-wrap">{errorDetails}</pre>
            </div>
            <button
              className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
