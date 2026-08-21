import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence: without this, a render error anywhere leaves the user
 * staring at a blank window with no way back.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("wingman: unhandled render error", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash" role="alert">
        <img src="/wingman.svg" alt="" width={56} height={56} />
        <h1>Wingman hit an unexpected error</h1>
        <p>
          The interface stopped rendering. Reloading usually clears it; the details below
          help if you want to report it.
        </p>
        <pre className="crash-detail">
          {error.name}: {error.message}
        </pre>
        <div className="crash-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => this.setState({ error: null })}
          >
            Try to continue
          </button>
        </div>
      </div>
    );
  }
}
