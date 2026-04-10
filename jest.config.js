/** @type {import('jest').Config} */
export default {
  // ESM support (Node ≥ 22 — lancé avec NODE_OPTIONS=--experimental-vm-modules)
  transform: {},

  // Deux projets : logique pure (node) et utilitaires localStorage (jsdom)
  projects: [
    {
      displayName: 'unit-node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/quiz/tests/unit/fuzzy.test.js',
                  '<rootDir>/quiz/tests/unit/game-engine.test.js'],
      transform: {},
    },
    {
      displayName: 'unit-jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/quiz/tests/unit/state.test.js'],
      transform: {},
    },
  ],
};
