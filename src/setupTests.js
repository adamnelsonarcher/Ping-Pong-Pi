// jest-dom adds custom jest matchers for asserting on DOM nodes, e.g.
// expect(element).toHaveTextContent(/react/i)
// https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

/**
 * Fill in browser globals that jsdom does not provide.
 *
 * Every browser this app supports has all of these; the jsdom bundled with
 * react-scripts 5 predates them. Without the polyfills, code that uses WebCrypto
 * silently takes its no-WebCrypto fallback branch and the tests pass for the
 * wrong reason — which is exactly what happened to the credential hashing before
 * this was added.
 */
const nodeCrypto = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

if (!global.crypto?.subtle) {
  Object.defineProperty(global, 'crypto', {
    value: nodeCrypto.webcrypto,
    configurable: true,
    writable: true,
  });
}

/**
 * recharts' ResponsiveContainer observes its parent to size the chart. jsdom has
 * no layout engine and no ResizeObserver, so without this any test that renders
 * the stats dialog dies with "ResizeObserver is not defined".
 *
 * A no-op is the right stub: there is nothing to measure in jsdom, and the tests
 * that matter here assert on the surrounding content rather than chart geometry.
 */
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}
