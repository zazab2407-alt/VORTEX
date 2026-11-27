import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import {
  describeError, formatLogHeading, initialBoundaryState, reconcileResetKey, resetBoundary, stateFromError,
  type BoundaryState,
} from '../utils/errorBoundary';

// This file must not import React Router or any context/provider. The outermost boundary (main.tsx) also has to work
// when a provider or the router itself is what crashed, so its fallback uses only React, icons and plain markup.

interface Props {
  children: ReactNode;
  /** 'app' = outermost boundary (full-page fallback). 'route' = inside Layout (fallback replaces only the page content). */
  scope?: 'app' | 'route';
  /** When this value changes while an error is showing, the boundary resets. The route boundary passes location.pathname. */
  resetKey?: string;
  /** The "Back to Store" control. Defaults to a plain link that reloads the home page, which works without a router. */
  homeLink?: ReactNode;
}

/** Catches render, lifecycle and lazy-chunk errors below it and shows a recoverable message instead of a blank page. */
export default class ErrorBoundary extends Component<Props, BoundaryState> {
  state: BoundaryState = initialBoundaryState(this.props.resetKey);

  static getDerivedStateFromError(thrown: unknown) {
    return stateFromError(thrown);
  }

  static getDerivedStateFromProps(props: Props, state: BoundaryState) {
    return reconcileResetKey(state, props.resetKey);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const componentStack = info.componentStack ?? null;
    // Console only. There is deliberately no monitoring service, network request or reporting endpoint.
    console.error(formatLogHeading(this.props.scope ?? 'app', error), error, componentStack);
    this.setState({ componentStack });
  }

  private tryAgain = () => this.setState((s) => resetBoundary(s));

  render() {
    if (!this.state.hasError) return this.props.children;
    const scope = this.props.scope ?? 'app';
    const view = describeError(this.state.error, import.meta.env.DEV);
    const home = this.props.homeLink ?? <a href="/" className="btn btn-outline">Back to Store</a>;
    return (
      <div role="alert" className={`flex flex-col items-center px-4 text-center ${scope === 'app' ? 'min-h-screen justify-center' : 'container-x py-20'}`}>
        <AlertTriangle size={48} className="text-neutral-300" />
        <p className="mt-3 font-display text-3xl font-bold uppercase">{view.title}</p>
        <p className="mt-1 max-w-md text-sm text-neutral-500">{view.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {/* A failed lazy chunk stays failed until the page reloads, so Reload is the primary action for that case */}
          <button type="button" onClick={this.tryAgain} className={`btn ${view.isChunkLoadError ? 'btn-outline' : 'btn-dark'}`}><RotateCw size={18} /> Try Again</button>
          <button type="button" onClick={() => window.location.reload()} className={`btn ${view.isChunkLoadError ? 'btn-dark' : 'btn-outline'}`}>Reload Page</button>
          {home}
        </div>
        {view.details && (
          <pre className="mt-8 max-h-64 w-full max-w-3xl overflow-auto border border-neutral-200 bg-neutral-50 p-4 text-left text-xs text-neutral-700">
            {view.details}{this.state.componentStack}
          </pre>
        )}
      </div>
    );
  }
}
