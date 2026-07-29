/**
 * Local development server.
 *
 * Serves the same express app as the Vercel deployment, so a route that works
 * here works there. It used to redeclare the routes and CORS separately, which
 * is how the two drifted apart.
 *
 * CRA's dev server proxies /api/* here — see the `proxy` field in package.json.
 */
const app = require('./api/index');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
