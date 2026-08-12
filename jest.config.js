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
    // ── Pyramide : mots (node, pas de DOM) ──────────────────────────────────
    {
      displayName: 'pyramide-words',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/pyramide/tests/unit/words.test.js'],
      transform: {},
    },
    // ── Taboo : logique de jeu (jsdom pour Web Audio) ────────────────────────
    {
      displayName: 'taboo-jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/taboo/tests/unit/game.test.js'],
      transform: {},
    },
    // ── Geo Party : logique de jeu (node, fetch mocké) ───────────────────────
    {
      displayName: 'geo-party-node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/geo-party/tests/unit/game.test.js'],
      transform: {},
    },
    // ── Blind-test : fuzzy + joker (node) ────────────────────────────────────
    {
      displayName: 'blind-test-node',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/blind-test/tests/unit/fuzzy.test.js',
        '<rootDir>/blind-test/tests/unit/joker.test.js',
      ],
      transform: {},
    },
    // ── Blind-test : playlist + audioSource (jsdom pour localStorage) ─────────
    {
      displayName: 'blind-test-jsdom',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/blind-test/tests/unit/playlist.test.js',
        '<rootDir>/blind-test/tests/unit/audioSource.test.js',
      ],
      transform: {},
    },
    // ── DJ Mix : player + mixFeatures (jsdom pour Audio / AudioContext) ────────
    {
      displayName: 'dj-mix-jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/dj-mix/tests/unit/**/*.test.js'],
      transform: {},
    },
    // ── Mix Blind Test : logique de pairing/cache (node) ─────────────────────
    {
      displayName: 'mix-blind-test-node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/mix-blind-test/tests/unit/game-logic.test.js'],
      transform: {},
    },
    // ── Mix Blind Test : StemClient IndexedDB blob store (node + fake-indexeddb)
    {
      displayName: 'mix-blind-test-idb',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/mix-blind-test/tests/unit/stem-client.test.js'],
      transform: {},
    },
    // ── Thème (party) : roundTimer (node, pas de DOM) ────────────────────────
    {
      displayName: 'theme-party-node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/theme-party/tests/unit/roundTimer.test.js'],
      transform: {},
    },
    // ── Thème (party) : themes + audioSource (jsdom pour localStorage) ──────
    {
      displayName: 'theme-party-jsdom',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/theme-party/tests/unit/themes.test.js',
        '<rootDir>/theme-party/tests/unit/audioSource.test.js',
      ],
      transform: {},
    },
  ],
};
