import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Migrated off Create React App (react-scripts), which was retired in 2025 and
// is the source of the app's remaining dependency advisories (docs/AUDIT.md
// S-09). Tests still run on Jest (see jest.config.cjs) so the suite was untouched
// by this change.
export default defineConfig(({ mode }) => {
  // Env from .env* files (local dev) merged with the real process env (Vercel).
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const merged = { ...fileEnv, ...process.env };

  // The code reads Firebase config as `process.env.REACT_APP_*`, the CRA
  // convention. Rather than rename everything — which would also mean renaming
  // the Vercel environment variables and would break the source under Jest — we
  // substitute those exact reads at build time. Only REACT_APP_* keys are
  // exposed; nothing else from the environment leaks into the bundle.
  const define = {};
  for (const key of Object.keys(merged)) {
    if (key.startsWith('REACT_APP_')) {
      define[`process.env.${key}`] = JSON.stringify(merged[key]);
    }
  }

  // The keys the app actually reads. Defining each unconditionally (defaulting to
  // '') guarantees no `process.env.REACT_APP_*` literal survives into the bundle,
  // where `process` is undefined and would throw. A missing var then degrades to
  // an empty string — sign-in fails gracefully rather than white-screening.
  const READ_BY_APP = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID',
    'REACT_APP_FIREBASE_MEASUREMENT_ID',
    'REACT_APP_API_URL',
  ];
  for (const key of READ_BY_APP) {
    if (!(`process.env.${key}` in define)) {
      define[`process.env.${key}`] = JSON.stringify('');
    }
  }

  return {
    plugins: [react()],
    define,
    build: {
      // Vercel's static build (vercel.json) expects the output in build/, as CRA
      // produced. Keeping it there means vercel.json did not have to change.
      outDir: 'build',
      sourcemap: true,
    },
    server: {
      port: 3000,
      // Mirrors CRA's `proxy` field: forward API calls to the local server.js.
      proxy: { '/api': 'http://localhost:3001' },
    },
  };
});
