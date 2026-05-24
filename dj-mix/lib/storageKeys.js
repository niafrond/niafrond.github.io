export const STORAGE_KEYS = Object.freeze({
  queue: 'dj-mix:queue',
  filRouge: 'dj-mix:fil-rouge',
  downloaderApiUrl: 'dj-mix:downloader:api:url',
  fxVisibility: 'dj-mix:fx:hidden',
  debugLogs: 'dj-mix:logs:debug',
  mixTransitionMode: 'dj-mix:transition:mode',
  trackMaxDuration: 'dj-mix:track:max-duration',
  trackMaxDurationEnabled: 'dj-mix:track:max-duration:enabled',
  ramFilterEnabled: 'dj-mix:ram-filter:enabled',
  ramTotalMbOverride: 'dj-mix:ram-filter:total-mb-override',
  autoDjFxSettings: 'dj-mix:auto-dj:fx:settings',
  crossfadeSeconds: 'dj-mix:crossfade-seconds',
  djMode: 'dj-mix:dj-mode',
  djModeGenrePrefs: 'dj-mix:dj-mode:genre-prefs',
});

export const DEFAULT_DOWNLOADER_API_URL = 'http://192.168.8.149:3000';
