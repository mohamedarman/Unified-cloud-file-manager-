import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetStorage = () => {
    try {
      const keysToRemove = [
        'ucfm_auth_user',
        'ucfm_accounts_v2',
        'ucfm_files_v2',
        'ucfm_capabilities_v2',
        'ucfm_quotas_v2',
        'ucfm_pending_ops_v2',
        'ucfm_audit_logs_v2',
        'ucfm_theme',
      ];
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              {this.props.fallbackTitle || 'Workspace Recovery'}
            </h1>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              Unified Cloud File Manager encountered an unexpected state and preserved your secure session.
            </p>

            {this.state.error && (
              <div className="w-full bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-left mb-6 overflow-hidden">
                <div className="text-xs font-mono text-red-400 truncate">
                  {this.state.error.message || 'Unknown error occurred'}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reload App
              </button>
              <button
                type="button"
                onClick={this.handleResetStorage}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium text-sm transition-colors border border-slate-700"
              >
                <Trash2 className="w-4 h-4" />
                Reset Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
