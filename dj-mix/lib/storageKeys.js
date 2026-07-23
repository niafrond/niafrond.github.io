export const STORAGE_KEYS = Object.freeze({
  queue: 'dj-mix:queue',
  filRouge: 'dj-mix:fil-rouge',
  tracks: 'dj-mix:tracks',
  downloaderApiUrl: 'dj-mix:downloader:api:url',
  downloaderApiToken: 'dj-mix:downloader:api:token',
  downloaderCdnUrl: 'dj-mix:downloader:cdn:url',
  fxVisibility: 'dj-mix:fx:hidden',
  debugLogs: 'dj-mix:logs:debug',
  mixTransitionMode: 'dj-mix:transition:mode',
  disabledTransitionModes: 'dj-mix:transition:disabled-modes',
  trackMaxDuration: 'dj-mix:track:max-duration',
  trackMaxDurationEnabled: 'dj-mix:track:max-duration:enabled',
  trackMaxDurationMode: 'dj-mix:track:max-duration:mode',
  trackMaxDurationPct: 'dj-mix:track:max-duration:pct',
  ramFilterEnabled: 'dj-mix:ram-filter:enabled',
  ramTotalMbOverride: 'dj-mix:ram-filter:total-mb-override',
  autoDjFxSettings: 'dj-mix:auto-dj:fx:settings',
  samplerSoundsSettings: 'dj-mix:sampling:sounds:settings',
  autoSuggestionQueueSearchEnabled: 'dj-mix:auto-dj:suggestion-queue-search:enabled',
  crossfadeSeconds: 'dj-mix:crossfade-seconds',
  queueLoop: 'dj-mix:queue:loop',
  queueShuffle: 'dj-mix:queue:shuffle',
  djMode: 'dj-mix:dj-mode',
  djModeGenrePrefs: 'dj-mix:dj-mode:genre-prefs',
  spotifyClientId: 'dj-mix:spotify:client-id',
  spotifyAuth: 'dj-mix:spotify:auth',
  spotifyFilRougeSource: 'dj-mix:spotify:fil-rouge-source',
  spotifyPlaylistHistory: 'dj-mix:spotify:playlist-history',
  djSetProfile: 'dj-mix:dj-api:set-profile',
  djExternalPlanEnabled: 'dj-mix:dj-plan:external-enabled',
  djBatchPlan: 'dj-mix:dj-api:batch-plan',
  artworkUrls: 'dj-mix:artwork-urls',
  relayMode: 'dj-mix:relay:mode',
  relayMasterId: 'dj-mix:relay:master-id',
  globalVolume: 'dj-mix:global-volume',
  filRougeSortMode: 'dj-mix:fil-rouge:sort',
  trackPaths: 'dj-mix:track-paths',
});

export const DEFAULT_DOWNLOADER_API_URL = 'http://vision:3000';
// Audio CDN: standalone process (audioCdnServer.js, AUDIO_CDN_PORT) that serves
// GET /api/stream and /api/stems/download independently of the main API, so
// playback keeps working even while the main API is busy with a long-running
// download/search task. Same host as the API by default, different port.
export const DEFAULT_DOWNLOADER_CDN_URL = 'http://vision:3002';
