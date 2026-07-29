import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// Minimal, modern ESLint. The project lost its linter when react-scripts was
// removed; this puts a guardrail back for the sloppiness that otherwise slips in
// (unused vars/imports, and — the valuable one — React hook-dependency bugs).
export default [
  { ignores: ['build/**', 'coverage/**', 'node_modules/**', 'public/**'] },

  js.configs.recommended,

  // App code: browser React with the automatic JSX runtime.
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // `process` is here because the Firebase config reads
      // process.env.REACT_APP_*; Vite replaces those with literals at build time
      // (see vite.config.js), so it is available even though this is browser code.
      globals: { ...globals.browser, process: 'readonly' },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      // Automatic runtime: React need not be in scope for JSX.
      'react/react-in-jsx-scope': 'off',
      // This project does not use prop-types.
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Server + API: Node CommonJS.
  {
    files: ['api/**/*.js', 'server.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  // Build/tool configs run in Node.
  {
    files: ['*.config.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Tests: add the Jest globals.
  {
    files: ['src/**/*.test.{js,jsx}', 'src/setupTests.js'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
  },
];
