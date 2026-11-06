import { Component, type ReactNode } from 'react';
import ErrorState from './ErrorState';

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[Workflow] Screen failed:', error);
  }

  render() {
    return this.state.failed ? (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorState message="Unable to display Workflow. Please try again." onRetry={() => window.location.reload()} />
      </div>
    ) : this.props.children;
  }
}
