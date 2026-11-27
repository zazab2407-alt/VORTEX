// Pure, framework-free logic for the React error boundaries (components/ErrorBoundary.tsx).
// Kept free of JSX, React and import.meta so the plain Node test runner can import it (tests/errorBoundary.test.mjs).

export interface BoundaryState {
  /** Tracked separately from `error` because JavaScript can throw null, undefined or a string. */
  hasError: boolean;
  error: Error | null;
  /** React's component stack for the caught error. Only ever shown in development. */
  componentStack: string | null;
  /** The key the boundary was last reset for (the route boundary uses location.pathname). */
  resetKey: string | undefined;
}

export interface ErrorView {
  title: string;
  message: string;
  /** Technical text. Always null outside development, so raw error messages never reach shoppers. */
  details: string | null;
  isChunkLoadError: boolean;
}

export const initialBoundaryState = (resetKey?: string): BoundaryState =>
  ({ hasError: false, error: null, componentStack: null, resetKey });

/** Anything can be thrown in JavaScript; the fallback always works with a real Error. */
export function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  if (typeof thrown === 'string' && thrown) return new Error(thrown);
  return new Error('A non-Error value was thrown');
}

// Messages browsers and Vite produce when a code-split chunk (the lazy admin pages) cannot be loaded,
// typically because a new version was deployed while a tab was still open.
const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
  /loading (css )?chunk [\w-]+ failed/i, // webpack-style
  /unable to preload css/i, // Vite
];

export function isChunkLoadError(thrown: unknown): boolean {
  const error = thrown instanceof Error ? thrown : null;
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  return CHUNK_ERROR_PATTERNS.some((p) => p.test(error.message));
}

/** What to show for an error. `isDev` is passed in (import.meta.env.DEV) so this stays testable under Node. */
export function describeError(thrown: unknown, isDev: boolean): ErrorView {
  const error = toError(thrown);
  const chunk = isChunkLoadError(error);
  return {
    title: 'Something went wrong',
    message: chunk
      ? 'Part of the store could not be loaded. This usually happens after an update. Please reload the page.'
      : 'An unexpected error stopped this page from displaying. You can try again or reload the page.',
    details: isDev ? `${error.name}: ${error.message}` : null,
    isChunkLoadError: chunk,
  };
}

/** React's static getDerivedStateFromError hook: the state to show once a child has thrown. */
export function stateFromError(thrown: unknown): Pick<BoundaryState, 'hasError' | 'error' | 'componentStack'> {
  return { hasError: true, error: toError(thrown), componentStack: null };
}

/**
 * React's static getDerivedStateFromProps hook: returns the new state when the reset key changed, otherwise null (no change).
 * A changed key clears any caught error, so navigating to another route recovers the route boundary.
 */
export function reconcileResetKey(state: BoundaryState, resetKey: string | undefined): BoundaryState | null {
  if (Object.is(state.resetKey, resetKey)) return null;
  return initialBoundaryState(resetKey);
}

/** "Try again": clear the error but keep the current key. Nothing reloads and no storage is touched. */
export const resetBoundary = (state: BoundaryState): BoundaryState => initialBoundaryState(state.resetKey);

/** The single line written to the console. The component stack is passed through unchanged. */
export function formatLogHeading(scope: string, error: Error): string {
  return `[VORTEX] ${scope} error boundary caught: ${error.name}: ${error.message}`;
}
