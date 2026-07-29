// Standalone Jest, replacing the runner that used to come bundled with
// react-scripts (docs/AUDIT.md S-09). Kept deliberately close to the CRA
// defaults so the 100+ existing tests ran unchanged after the Vite migration.
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  testMatch: ['<rootDir>/src/**/*.test.{js,jsx}'],
  transform: {
    // babel-jest with presets inline, so this Babel config is scoped to Jest and
    // never seen by Vite's own React plugin.
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          ['@babel/preset-react', { runtime: 'automatic' }],
        ],
      },
    ],
  },
  moduleNameMapper: {
    // Components import their own CSS; jsdom has no stylesheet handling, so map
    // style imports to a harmless stub (CRA did the equivalent).
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  // node_modules ships ESM/CJS that is already valid for Node; don't transform it.
  transformIgnorePatterns: ['/node_modules/'],
};
