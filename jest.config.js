/** @type {import('jest').Config} */
export default {
  // ESM support (Node ≥ 22 — lancé avec NODE_OPTIONS=--experimental-vm-modules)
  transform: {},

  projects: [
    // ── Quiz : logique pure (node) ──
    {
      displayName: 'unit-node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/quiz/tests/unit/fuzzy.test.js',
                  '<rootDir>/quiz/tests/unit/game-engine.test.js'],
      transform: {},
    },
    // ── Quiz : utilitaires localStorage (jsdom) ──
    {
      displayName: 'unit-jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/quiz/tests/unit/state.test.js'],
      transform: {},
    },
    // ── Flash Guess : state (node, pas de DOM) ──
    {
      displayName: 'fg-node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/flash-guess/tests/unit/state.test.js'],
      transform: {},
    },
    // ── Flash Guess : modules avec localStorage / DOM (jsdom) ──
    {
      displayName: 'fg-jsdom',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/flash-guess/tests/unit/words.test.js',
        '<rootDir>/flash-guess/tests/unit/game.test.js',
        '<rootDir>/flash-guess/tests/unit/setup.test.js',
        '<rootDir>/flash-guess/tests/unit/members.test.js',
      ],
      transform: {},
    },
  ],
};
