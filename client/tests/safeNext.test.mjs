// Redirect-security regression tests for the post-login "next" parameter (Login.tsx and Register.tsx use safeNext).
// Uses only node:test; Node runs the .ts file directly. The router cases use the real react-router library in memory,
// so they keep protecting the app across router upgrades (6.x -> 7.x).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRouter } from 'react-router-dom';
import * as rr from 'react-router-dom';
import { safeNext } from '../src/utils/safeNext.ts';

const attacks = {
  'protocol-relative': '//evil.com',
  'triple slash': '///evil.com',
  'slash + backslash': '/\\evil.com',
  'backslash only': '\\\\evil.com',
  'absolute https': 'https://evil.com/account',
  'absolute http': 'http://evil.com',
  'javascript scheme': 'javascript:alert(1)',
  'data scheme': 'data:text/html,<script>alert(1)</script>',
  'bare host': 'evil.com',
  'tab inside (browsers delete it, leaving //)': '/\t/evil.com',
  'newline inside': '/\n/evil.com',
  'carriage return inside': '/\r/evil.com',
  'space inside': '/ /evil.com',
  'NUL inside': '/\u0000/evil.com',
  'unicode line separator': '/\u2028/evil.com',
  'leading space': ' /account',
  'leading tab before //': '\t//evil.com',
  empty: '',
  null: null,
};

const allowed = [
  '/', '/account', '/admin', '/admin/products/new', '/orders/VTX-261122-ABCD2345',
  '/product/flux-high-waist-leggings?size=M&color=Black', '/checkout#payment', '/shop?category=women&sort=price-asc',
  '/%2F/evil.com', // percent-encoded slashes stay a path on this site
  '/shop?next=//evil.com', // a "//" inside the query string is data, not a destination
];

describe('safeNext rejects open-redirect attempts', () => {
  for (const [name, value] of Object.entries(attacks)) {
    test(`rejects ${name}`, () => assert.equal(safeNext(value), null));
  }
});

describe('safeNext keeps legitimate same-site destinations unchanged', () => {
  for (const value of allowed) test(`allows ${JSON.stringify(value)}`, () => assert.equal(safeNext(value), value));
});

describe('round trip through the route guards', () => {
  // RequireAuth/RequireAdmin send visitors to `/login?next=<encoded path + search>`; Login then reads it back.
  for (const where of ['/account', '/orders/VTX-1', '/admin/orders?status=pending&page=2', '/checkout']) {
    test(`${where} survives encode -> URLSearchParams -> safeNext`, () => {
      const loginUrl = `/login?next=${encodeURIComponent(where)}`;
      assert.equal(safeNext(new URL(loginUrl, 'http://x.test').searchParams.get('next')), where);
    });
  }
  test('an attacker-built login link cannot smuggle an external destination', () => {
    for (const evil of ['//evil.com', 'https://evil.com', '/\\evil.com', '/\t/evil.com']) {
      const next = new URL(`/login?next=${encodeURIComponent(evil)}`, 'http://x.test').searchParams.get('next');
      assert.equal(safeNext(next), null, evil);
    }
  });
});

describe('with the real router', () => {
  const fallback = '/account';
  const land = async (raw) => {
    const router = createMemoryRouter([{ path: '*', element: null }], { initialEntries: ['/login'] });
    try {
      await router.navigate(safeNext(raw) ?? fallback, { replace: true });
      return router.state.location;
    } finally { router.dispose(); }
  };
  test('every attack ends on the fallback page, on this site', async () => {
    for (const [name, value] of Object.entries(attacks)) assert.equal((await land(value)).pathname, fallback, name);
  });
  test('legitimate destinations are reached exactly', async () => {
    const loc = await land('/product/flux-high-waist-leggings?size=M&color=Black');
    assert.equal(loc.pathname, '/product/flux-high-waist-leggings');
    assert.equal(loc.search, '?size=M&color=Black');
  });
});

describe('router API used by the app is still exported (declarative mode)', () => {
  for (const name of ['BrowserRouter', 'Routes', 'Route', 'Link', 'NavLink', 'Navigate', 'Outlet', 'useNavigate', 'useLocation', 'useParams', 'useSearchParams']) {
    // Components such as Link/NavLink are forwardRef objects, hooks and BrowserRouter are functions; either way it must exist.
    test(name, () => assert.ok(['function', 'object'].includes(typeof rr[name]) && rr[name] !== null, `${name} is exported`));
  }
});
