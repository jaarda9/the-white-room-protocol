import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[System Error Boundary Caught]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleNavigateHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] w-full flex items-center justify-center p-6 font-mono">
          <div className="relative max-w-md w-full bg-[#0a1b2e]/95 border-2 border-red-500/70 rounded-[4px] p-6 text-white shadow-[0_0_30px_rgba(239,68,68,0.25),inset_0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-md space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm tracking-wider">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              <span>[ SYSTEM CALIBRATION WARNING ]</span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {this.props.fallbackMessage ||
                'A temporary interface anomaly occurred while loading records or charts. The System state remains secure.'}
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-white text-black font-bold text-xs rounded-[2px] hover:bg-gray-200 transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,255,255,0.3)]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>REINITIALIZE INTERFACE</span>
              </button>

              <button
                type="button"
                onClick={this.handleNavigateHome}
                className="px-4 py-2 bg-[#061426] border border-white/30 text-white font-bold text-xs rounded-[2px] hover:bg-[#0c243d] transition-all flex items-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>HUNTER SANCTUARY</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
