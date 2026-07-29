/**
 * Base URL for API calls.
 *
 * Empty in both environments, i.e. same-origin relative requests:
 *  - production: the API is served from the same Vercel deployment as the app
 *  - development: CRA's dev server proxies /api/* to the express server on 3001
 *    (see the `proxy` field in package.json)
 *
 * This used to hardcode http://localhost:3000 in development while the express
 * server listened on 3001. It only worked because the proxy caught it, and it
 * broke outright whenever CRA started on a different port because 3000 was
 * already taken (docs/AUDIT.md L-15).
 */
const API_URL = process.env.REACT_APP_API_URL || '';

export default API_URL;
