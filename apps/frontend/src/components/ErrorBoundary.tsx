import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Renders the fallback inline (a card, no full-viewport centering) —
   * for a boundary nested inside a layout that already has its own chrome
   * (sidebar, nav) which should stay on screen after a crash. */
  compact?: boolean;
}

interface State {
  error: Error | null;
}

/** Catches render-time exceptions anywhere below it so the app shows a
 * recoverable screen instead of an unstyled blank page. There was no
 * ErrorBoundary anywhere in the app before this. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("Unhandled error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const card = (
        <div className="card elev-md" style={{ padding: 32, gap: 12, maxWidth: 420, textAlign: "center", alignItems: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, margin: 0, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
            Please refresh the page. If this keeps happening, let us know what you were doing.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      );

      if (this.props.compact) {
        return <div style={{ display: "grid", placeItems: "center", padding: "40px 24px" }}>{card}</div>;
      }
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>{card}</div>
      );
    }

    return this.props.children;
  }
}
