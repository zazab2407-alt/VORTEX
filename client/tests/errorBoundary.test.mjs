// Tests for the error boundary logic (src/utils/errorBoundary.ts) and a few wiring checks on the components that use it.
// Uses only node:test, like the other client tests. The class component itself contains JSX and needs a DOM, so its behaviour
// is covered by this pure logic plus source checks; see the report for what still needs a real browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initialBoundaryState, toError, isChunkLoadError, describeError, stateFromError,
  reconcileResetKey, resetBoundary, formatLogHeading,
} from '../src/utils/errorBoundary.ts';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('toError and stateFromError (error-state handling)', () => {
  test('keeps real Error objects', () => {
    const e = new TypeError('boom');
    assert.equal(toError(e), e);
  });
  test('wraps strings and other thrown values in an Error', () => {
    assert.equal(toError('text').message, 'text');
    assert.ok(toError(null) instanceof Error);
    assert.ok(toError(undefined) instanceof Error);
    assert.ok(toError({ a: 1 }) instanceof Error);
    assert.ok(toError('') instanceof Error);
  });
  test('a caught error sets hasError', () => {
    const s = stateFromError(new Error('x'));
    assert.equal(s.hasError, true);
    assert.equal(s.error.message, 'x');
  });
  test('throwing null or undefined still counts as an error (hasError is separate from error)', () => {
    for (const thrown of [null, undefined, 0, false, '']) {
      const s = stateFromError(thrown);
      assert.equal(s.hasError, true, `thrown ${String(thrown)}`);
      assert.ok(s.error instanceof Error);
    }
  });
  test('the initial state has no error', () => {
    assert.deepEqual(initialBoundaryState('/shop'), { hasError: false, error: null, componentStack: null, resetKey: '/shop' });
  });
});

describe('isChunkLoadError (chunk-load error detection)', () => {
  const positives = [
    'Failed to fetch dynamically imported module: https://x.test/assets/Orders-abc.js',
    'error loading dynamically imported module: https://x.test/assets/Orders-abc.js',
    'Importing a module script failed.',
    'Loading chunk 12 failed.',
    'Loading CSS chunk vendors failed.',
    'Unable to preload CSS for /assets/index-abc.css',
  ];
  for (const message of positives) {
    test(`detects: ${message.slice(0, 50)}`, () => assert.equal(isChunkLoadError(new TypeError(message)), true));
  }
  test('detects ChunkLoadError by name', () => {
    const e = new Error('anything');
    e.name = 'ChunkLoadError';
    assert.equal(isChunkLoadError(e), true);
  });
  test('ordinary errors and non-errors are not chunk errors', () => {
    assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')")), false);
    assert.equal(isChunkLoadError(new Error('Network request failed')), false);
    assert.equal(isChunkLoadError('Failed to fetch dynamically imported module'), false);
    assert.equal(isChunkLoadError(null), false);
    assert.equal(isChunkLoadError(undefined), false);
  });
});

describe('describeError (what users see)', () => {
  const secret = 'internal detail: db password hunter2 at /srv/app.js:10';
  test('production never contains the raw error message or any technical details', () => {
    const v = describeError(new Error(secret), false);
    assert.equal(v.details, null);
    assert.equal(v.title, 'Something went wrong');
    assert.ok(!v.message.includes('hunter2') && !v.message.includes('internal detail'));
  });
  test('production hides details for non-Error throws too', () => {
    assert.equal(describeError('plain string secret', false).details, null);
    assert.ok(!describeError('plain string secret', false).message.includes('secret'));
  });
  test('development shows the error name and message', () => {
    const v = describeError(new RangeError('bad range'), true);
    assert.equal(v.details, 'RangeError: bad range');
  });
  test('chunk errors get their own reload-oriented message', () => {
    const chunk = describeError(new TypeError('Failed to fetch dynamically imported module: x'), false);
    const other = describeError(new Error('x'), false);
    assert.equal(chunk.isChunkLoadError, true);
    assert.equal(other.isChunkLoadError, false);
    assert.notEqual(chunk.message, other.message);
    assert.match(chunk.message, /reload/i);
    assert.ok(!chunk.message.includes('dynamically imported'));
  });
});

describe('reset behaviour', () => {
  const crashed = (key) => ({ ...initialBoundaryState(key), ...stateFromError(new Error('x')), componentStack: '\n at Page' });

  test('same key: no change (null), so the error stays on screen', () => {
    assert.equal(reconcileResetKey(crashed('/shop'), '/shop'), null);
    assert.equal(reconcileResetKey(crashed(undefined), undefined), null);
  });
  test('changed key (navigation) clears the error and stores the new key', () => {
    const next = reconcileResetKey(crashed('/shop'), '/cart');
    assert.deepEqual(next, { hasError: false, error: null, componentStack: null, resetKey: '/cart' });
  });
  test('a healthy boundary just records the new key', () => {
    const next = reconcileResetKey(initialBoundaryState('/a'), '/b');
    assert.equal(next.hasError, false);
    assert.equal(next.resetKey, '/b');
  });
  test('route sequence: crash on /shop, stay, then recover on /cart', () => {
    let state = crashed('/shop');
    state = reconcileResetKey(state, '/shop') ?? state;
    assert.equal(state.hasError, true);
    state = reconcileResetKey(state, '/cart') ?? state;
    assert.equal(state.hasError, false);
  });
  test('same pathname with a new error after reset is caught again', () => {
    let state = reconcileResetKey(crashed('/shop'), '/cart');
    state = { ...state, ...stateFromError(new Error('again')) };
    assert.equal(state.hasError, true);
    assert.equal(reconcileResetKey(state, '/cart'), null);
  });
  test('Try Again clears the error and keeps the key', () => {
    const next = resetBoundary(crashed('/shop'));
    assert.deepEqual(next, { hasError: false, error: null, componentStack: null, resetKey: '/shop' });
  });
});

describe('logging', () => {
  test('log heading names the scope and error', () => {
    assert.equal(formatLogHeading('route', new TypeError('bad')), '[VORTEX] route error boundary caught: TypeError: bad');
  });
});

describe('wiring and safety checks on the source files', () => {
  const boundary = read('../src/components/ErrorBoundary.tsx');
  const main = read('../src/main.tsx');
  const layout = read('../src/components/Layout.tsx');
  const helper = read('../src/utils/errorBoundary.ts');

  test('the boundary and its helper import no router, context, provider or hook', () => {
    for (const src of [boundary, helper]) {
      const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
      for (const spec of imports) {
        assert.ok(!/react-router/.test(spec), `router import: ${spec}`);
        assert.ok(!/context|hooks\//.test(spec), `app state import: ${spec}`);
      }
    }
    assert.ok(!/useLocation|useNavigate|useAuth|useCart|useToast/.test(boundary));
  });
  test('uses the required React hooks, logs the component stack with console.error', () => {
    assert.match(boundary, /static getDerivedStateFromError/);
    assert.match(boundary, /componentDidCatch\(error: Error, info: ErrorInfo\)/);
    assert.match(boundary, /console\.error\(.*componentStack/);
  });
  test('no network reporting and no storage access', () => {
    assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(boundary + helper));
    assert.ok(!/localStorage|sessionStorage/.test(boundary + helper));
  });
  test('reload happens only from a click, never automatically', () => {
    const uses = boundary.match(/location\.reload/g) ?? [];
    assert.equal(uses.length, 1);
    assert.match(boundary, /onClick=\{\(\) => window\.location\.reload\(\)\}/);
    assert.ok(!/setTimeout|setInterval|componentDidMount|useEffect/.test(boundary));
  });
  test('development-only details are gated by import.meta.env.DEV', () => {
    assert.match(boundary, /describeError\(this\.state\.error, import\.meta\.env\.DEV\)/);
  });
  test('main.tsx wraps the whole App (providers included) in the boundary', () => {
    assert.match(main, /import ErrorBoundary from '\.\/components\/ErrorBoundary'/);
    assert.match(main, /<ErrorBoundary>\s*<App \/>\s*<\/ErrorBoundary>/);
    assert.ok(main.indexOf('<ErrorBoundary>') > main.indexOf('<React.StrictMode>'));
  });
  test('Layout wraps only the Outlet, resets on pathname, and leaves the shell outside', () => {
    assert.match(layout, /<ErrorBoundary scope="route" resetKey=\{pathname\}/);
    assert.match(layout, /<ErrorBoundary scope="route"[\s\S]*?>\s*<Outlet \/>\s*<\/ErrorBoundary>/);
    const open = layout.indexOf('<ErrorBoundary');
    const close = layout.indexOf('</ErrorBoundary>');
    for (const shell of ['<Navbar />', '<Footer />', '<CartDrawer />', '<AnnouncementBar />']) {
      const at = layout.indexOf(shell);
      assert.ok(at !== -1 && (at < open || at > close), `${shell} must stay outside the boundary`);
    }
  });
});
