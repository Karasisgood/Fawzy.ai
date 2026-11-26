import {Component} from 'react';
import type {ErrorInfo, ReactNode} from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-white p-6 text-slate-900 dark:bg-[#0B1120] dark:text-slate-100">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center dark:border-slate-800 dark:bg-[#0F172A]">
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Please reload the page to continue using fawzy.ai.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#122B8E] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0e2273]"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
