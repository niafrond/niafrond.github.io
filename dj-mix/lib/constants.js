// ─── Audio effects (mixFeatures.js) ──────────────────────────────────────────
export const FFT_SIZE             = 1024;
export const SMOOTH_TAU           = 0.08;   // AudioParam setTargetAtTime time-constant (s)
export const SMOOTH_JS            = 0.34;   // lerp α for computeAdaptiveMidSideGains
export const ENERGY_EPSILON       = 1e-4;
export const DISTORTION_K         = 140;
export const DISTORTION_WET_MIX   = 0.36;
export const DISTORTION_DRY_MIX   = 0.84;
export const ECHO_DELAY_S         = 0.22;
export const ECHO_FEEDBACK        = 0.28;
export const ECHO_WET_MIX         = 0.28;
export const ECHO_DRY_MIX         = 0.9;
export const STEM_SYNC_INTERVAL_MS = 2500;

// ─── DJ FX controller (djFxController.js) ────────────────────────────────────
export const LOOP_CUE_REPEAT_COUNT = 3;
export const LOOP_CUE_INTERVAL_MS  = 1500;

// ─── Spotify sync (spotifyController.js) ─────────────────────────────────────
export const SPOTIFY_FIL_ROUGE_POLL_MS               = 120_000;
export const SPOTIFY_FIL_ROUGE_BACKOFF_MAX_MULTIPLIER = 32;

// ─── Background loops (main.js) ───────────────────────────────────────────────
export const METRICS_LOG_INTERVAL_MS = 60_000;

// ─── Search (searchController.js) ────────────────────────────────────────────
export const SEARCH_DEBOUNCE_MS        = 600;

// ─── Track duration limits (settingsController.js) ───────────────────────────
export const TRACK_MAX_DURATION_MIN_SEC = 0;
export const TRACK_MAX_DURATION_MAX_SEC = 600;
export const TRACK_MAX_DURATION_PCT_MIN = 5;
export const TRACK_MAX_DURATION_PCT_MAX = 95;

// ─── RAM limits (settingsController.js / ramProfile.js) ──────────────────────
export const RAM_MIN_MB = 512;
export const RAM_MAX_MB = 32_768;

// ─── DJ FX interval presets (djModeController.js / autoDjFxManager.js) ───────
export const DANCE_MODE_MIN_INTERVAL_SEC  = 8;
export const DANCE_MODE_MAX_INTERVAL_SEC  = 20;
export const MUSIC_MODE_LOW_BPM_THRESHOLD = 90;
export const MUSIC_MODE_LOW_MIN_INTERVAL  = 40;
export const MUSIC_MODE_LOW_MAX_INTERVAL  = 120;
export const MUSIC_MODE_NORM_MIN_INTERVAL = 20;
export const MUSIC_MODE_NORM_MAX_INTERVAL = 60;

// ─── Scheduling helpers ───────────────────────────────────────────────────────
export const IDLE_SCHEDULE_FALLBACK_MS = 80;
export const IDLE_SCHEDULE_TIMEOUT_MS  = 2000;

// ─── Adaptive download batching (Fil Rouge background downloads) ─────────────
export const INITIAL_PARALLEL_DOWNLOADS   = 3;
export const MIN_PARALLEL_DOWNLOADS       = 2;
export const MAX_PARALLEL_DOWNLOADS       = 10;
export const TARGET_MS_PER_TRACK_DOWNLOAD = 4000;

// ─── Download retry policy (downloadBatchManager.js, SPEC-19.6) ──────────────
export const MAX_DOWNLOAD_RETRY_ATTEMPTS     = 3;
export const DOWNLOAD_RETRY_BACKOFF_BASE_MS  = 2000; // 2s, 4s, 8s (base · 2^(n−1))
