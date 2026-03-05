import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          <AlertTriangle size={48} className="mb-4 text-expense" />
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-text-muted mb-6 max-w-xs">
            An unexpected error occurred. Your data is safe — try reloading.
          </p>
          <Button onClick={() => { this.setState({ hasError: false, error: null }); }}>
            <RefreshCw size={16} /> Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
