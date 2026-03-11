import { createCheatModeSection } from "./cheatMode.js";
import { getMatch3Version } from "./version.js";

// ===============================
// CONSTANTES
// ===============================

const AUDIO_SETTINGS_KEY = 'match3quest.audio.settings';

const defaultSettings = {
    muted: false,
    mutedMusic: false,
    mutedSfx: false,
    volume: 0.6,
    musicVolume: 0.6,
    sfxVolume: 0.6,
    cheatMode: false,
    developerMode: false
};

const AMBIENT_TRACKS_BY_MOOD = {
    sweet: ['./mp3/sweet.mp3', './mp3/sweet2.mp3'],
    epic:  ['./mp3/epic.mp3',  './mp3/epic2.mp3']
};

const AMBIENT_VOLUME_BY_MOOD = {
    sweet: 0.52,
    epic:  0.66
};

const AMBIENT_MOOD_BY_FAMILY = {
    default:   'sweet',
    dragon:    'epic',
    elemental: 'epic',
    monster:   'epic',
    troll:     'epic',
    construct: 'epic',
    undead:    'epic',
    vampire:   'epic'
};

const AMBIENT_RACE_ALIASES = {
    dragon:          'dragon',
    vampire:         'vampire',
    orc:             'orc',
    construct:       'construct',
    'mort-vivant':   'undead',
    'mort vivant':   'undead',
    mortvivant:      'undead',
    gobelin:         'goblin',
    goblin:          'goblin',
    elementaire:     'elemental',
    elemental:       'elemental',
    humain:          'human',
    human:           'human',
    esprit:          'spirit',
    spirit:          'spirit',
    elfe:            'elf',
    elf:             'elf',
    monstre:         'monster',
    monster:         'monster',
    troll:           'troll'
};

const DEV_MODE_CLICK_TARGET = 6;

// ===============================
// ÉTAT GLOBAL
// ===============================

let settings = { ...defaultSettings };
let audioContext = null;
let ambientAudioByMood = null;
let activeAmbientAudio = null;
let activeBattleMusicAudio = null;
let ambientWasPlayingBeforeBattle = false;
let ambientFadeTimerId = null;
let combatMusicEnabled = false;
let audioPrimed = false;
let combatMusicFamily = 'default';
let combatMusicMood = 'sweet';
let audioVisibilityGuardInitialized = false;
let ambientPausedByFocusLoss = false;

// ===============================
// CACHE INDEXEDDB
// ===============================

const AUDIO_DB_NAME  = 'match3-audio-cache';
const AUDIO_DB_STORE = 'audio-files';
let audioDbPromise = null;

function openAudioDb() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (audioDbPromise) return audioDbPromise;

    audioDbPromise = new Promise((resolve) => {
        const req = indexedDB.open(AUDIO_DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(AUDIO_DB_STORE)) {
                db.createObjectStore(AUDIO_DB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror  = () => resolve(null);
    });

    return audioDbPromise;
}

async function getAudioFromCache(filename) {
    const db = await openAudioDb();
    if (!db) return null;
    return new Promise((resolve) => {
        const tx    = db.transaction(AUDIO_DB_STORE, 'readonly');
        const store = tx.objectStore(AUDIO_DB_STORE);
        const req   = store.get(filename);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
    });
}

async function saveAudioToCache(filename, blob) {
    const db = await openAudioDb();
    if (!db) return;
    return new Promise((resolve) => {
        const tx    = db.transaction(AUDIO_DB_STORE, 'readwrite');
        const store = tx.objectStore(AUDIO_DB_STORE);
        const req   = store.put(blob, filename);
        req.onsuccess = () => resolve();
        req.onerror   = () => resolve();
    });
}

async function fetchAudioBlob(filename, url) {
    const cached = await getAudioFromCache(filename);
    if (cached) return cached;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`audio download failed: ${url}`);

    const blob = await resp.blob();
    try { await saveAudioToCache(filename, blob); } catch {}
    return blob;
}

/**
 * Crée un élément Audio en utilisant le cache IndexedDB pour les .mp3.
 * Retourne une promesse résolue avec l'Audio prêt (src assigné, pas encore joué).
 */
async function createAudio(src) {
    const audio = new Audio();
    audio.loop    = true;
    audio.preload = 'auto';

    if (src.endsWith('.mp3')) {
        try {
            const filename = src.split('/').pop();
            const blob = await fetchAudioBlob(filename, src);
            audio.src  = URL.createObjectURL(blob);
        } catch {
            audio.src = src;
        }
    } else {
        audio.src = src;
    }

    return audio;
}

// ===============================
// PRÉCHARGEMENT AU DÉMARRAGE
// ===============================

// PRÉCHARGEMENT AU DÉMARRAGE ET INIT TRACKS_LIST

async function preloadAllAudioToIndexedDBAndTracksList() {
    try {
        const resp = await fetch('./tracks.json');
        if (!resp.ok) return;
        const tracks = await resp.json();
        if (!Array.isArray(tracks)) return;
        // Remplit window.TRACKS_LIST si absent
        if (typeof window !== 'undefined' && !window.TRACKS_LIST) {
            window.TRACKS_LIST = tracks
        }
        // Précharge les mp3
        for (const filename of tracks) {
                fetchAudioBlob(filename, './mp3/' + filename).catch(() => {});
        }
    } catch {}
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(preloadAllAudioToIndexedDBAndTracksList, 100);
    } else {
        document.addEventListener('DOMContentLoaded', () => setTimeout(preloadAllAudioToIndexedDBAndTracksList, 100));
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(preloadAllAudioToIndexedDBAndTracksList, 100);
    } else {
        document.addEventListener('DOMContentLoaded', () => setTimeout(preloadAllAudioToIndexedDBAndTracksList, 100));
    }
}

// ===============================
// UTILITAIRES VOLUME / PARAMÈTRES
// ===============================

function clampVolume(v, fallback = defaultSettings.volume) {
    return Math.max(0, Math.min(1, Number.isFinite(v) ? v : fallback));
}

function isStoredVolume(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
}

function getMusicVolume() {
    return clampVolume(settings.musicVolume, defaultSettings.musicVolume);
}

function getSfxVolume() {
    return clampVolume(settings.sfxVolume, defaultSettings.sfxVolume);
}

function setMusicVolume(volume) {
    settings.musicVolume = clampVolume(volume, defaultSettings.musicVolume);
    syncLegacyVolumeSetting();
}

function setSfxVolume(volume) {
    settings.sfxVolume = clampVolume(volume, defaultSettings.sfxVolume);
    syncLegacyVolumeSetting();
}

function syncLegacyVolumeSetting() {
    settings.volume = clampVolume((settings.musicVolume + settings.sfxVolume) / 2);
}

function isMusicMuted() {
    return Boolean(settings.mutedMusic || settings.muted);
}

function isSfxMuted() {
    return Boolean(settings.mutedSfx || settings.muted);
}

function getMuteMode() {
    const musicMuted = isMusicMuted();
    const sfxMuted   = isSfxMuted();
    if (musicMuted && sfxMuted) return 'all';
    if (musicMuted)             return 'music';
    if (sfxMuted)               return 'sfx';
    return 'none';
}

function applyMuteMode(mode) {
    switch (mode) {
        case 'all':
            settings.mutedMusic = true;
            settings.mutedSfx   = true;
            break;
        case 'music':
            settings.mutedMusic = true;
            settings.mutedSfx   = false;
            break;
        case 'sfx':
            settings.mutedMusic = false;
            settings.mutedSfx   = true;
            break;
        default:
            settings.mutedMusic = false;
            settings.mutedSfx   = false;
            break;
    }
    settings.muted = settings.mutedMusic && settings.mutedSfx;
}

// ===============================
// PERSISTANCE
// ===============================

function loadSettings() {
    try {
        const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const legacyMuted  = Boolean(parsed?.muted);
        const hasSplitFlags = typeof parsed?.mutedMusic === 'boolean' || typeof parsed?.mutedSfx === 'boolean';

        if (hasSplitFlags) {
            settings.mutedMusic = Boolean(parsed?.mutedMusic);
            settings.mutedSfx   = Boolean(parsed?.mutedSfx);
            settings.muted      = settings.mutedMusic && settings.mutedSfx;
        } else {
            settings.muted      = legacyMuted;
            settings.mutedMusic = legacyMuted;
            settings.mutedSfx   = legacyMuted;
        }

        const parsedVolume      = Number(parsed?.volume);
        const legacyVolume      = isStoredVolume(parsedVolume) ? parsedVolume : defaultSettings.volume;
        const parsedMusicVolume = Number(parsed?.musicVolume);
        const parsedSfxVolume   = Number(parsed?.sfxVolume);

        settings.musicVolume = isStoredVolume(parsedMusicVolume) ? parsedMusicVolume : legacyVolume;
        settings.sfxVolume   = isStoredVolume(parsedSfxVolume)   ? parsedSfxVolume   : legacyVolume;
        syncLegacyVolumeSetting();

        settings.developerMode = Boolean(parsed?.developerMode);
        settings.cheatMode     = Boolean(parsed?.cheatMode);
        if (!settings.developerMode) {
            settings.cheatMode = false;
        }
    } catch {
        settings = { ...defaultSettings };
    }
}

function saveSettings() {
    try {
        syncLegacyVolumeSetting();
        localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Ignore les erreurs de storage (mode privé, quota dépassé…)
    }
}

// ===============================
// CONTEXTE AUDIO WEB
// ===============================

function getAudioContext(options = {}) {
    const { allowCreate = true } = options;
    if (typeof window === 'undefined') return null;
    if (audioContext) return audioContext;
    if (!allowCreate || !audioPrimed) return null;

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;

    audioContext = new Ctor();
    return audioContext;
}

function resumeAudioContext(options = {}) {
    const ctx = getAudioContext(options);
    if (!ctx) return;
    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }
}

// ===============================
// RÉSOLUTION FAMILLE / MOOD COMBAT
// ===============================

function normalizeCombatFamilyName(value) {
    if (typeof value !== 'string') return '';
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // accents
        .replace(/[_]+/g, ' ')
        .replace(/[^\w\s-]/g, '')
        .trim();
}

function resolveCombatMusicFamily(value) {
    const normalized = normalizeCombatFamilyName(value);
    if (!normalized) return 'default';
    const mapped = AMBIENT_RACE_ALIASES[normalized] || normalized;
    return Object.prototype.hasOwnProperty.call(AMBIENT_MOOD_BY_FAMILY, mapped) ? mapped : 'default';
}

function resolveCombatMusicMood(value) {
    if (typeof value !== 'string') return 'sweet';
    return value.toLowerCase().trim() === 'epic' ? 'epic' : 'sweet';
}

function getEffectiveCombatMood() {
    return combatMusicMood === 'epic' ? 'epic' : 'sweet';
}

// ===============================
// POOL AUDIO AMBIANT
// ===============================

function ensureAmbientAudioPool() {
    if (typeof Audio === 'undefined') return null;
    if (ambientAudioByMood) return ambientAudioByMood;

    ambientAudioByMood = {};
    Object.entries(AMBIENT_TRACKS_BY_MOOD).forEach(([mood, tracks]) => {
        ambientAudioByMood[mood] = tracks.map((src) => {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.loop    = true;
            audio.volume  = 0;
            audio.dataset.combatMood = mood;
            return audio;
        });
    });

    return ambientAudioByMood;
}

function getAmbientTargetVolume() {
    const mood           = getEffectiveCombatMood();
    const moodMultiplier = AMBIENT_VOLUME_BY_MOOD[mood] ?? 0.52;
    return clampVolume(getMusicVolume() * moodMultiplier, defaultSettings.musicVolume);
}

function clearAmbientFadeTimer() {
    if (ambientFadeTimerId !== null) {
        window.clearInterval(ambientFadeTimerId);
        ambientFadeTimerId = null;
    }
}

function fadeAudioVolume(audio, target, durationMs = 420) {
    if (!audio) return;
    clearAmbientFadeTimer();

    const start     = Number.isFinite(audio.volume) ? audio.volume : 0;
    const end       = clampVolume(target);
    const duration  = Math.max(1, Number(durationMs) || 1);
    const startedAt = Date.now();

    if (Math.abs(start - end) < 0.01) {
        audio.volume = end;
        return;
    }

    ambientFadeTimerId = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const ratio   = Math.min(1, elapsed / duration);
        audio.volume  = clampVolume(start + ((end - start) * ratio));
        if (ratio >= 1) clearAmbientFadeTimer();
    }, 30);
}

function pickAmbientTrack(mood) {
    const pool   = ensureAmbientAudioPool();
    const tracks = pool?.[mood];
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    if (tracks.length === 1) return tracks[0];

    const currentIndex = activeAmbientAudio ? tracks.indexOf(activeAmbientAudio) : -1;
    if (currentIndex === -1) {
        return tracks[Math.floor(Math.random() * tracks.length)];
    }
    const offset = 1 + Math.floor(Math.random() * (tracks.length - 1));
    return tracks[(currentIndex + offset) % tracks.length];
}

function startAmbientLoop() {
    if (isMusicMuted() || !combatMusicEnabled || !audioPrimed) return;
    if (!isGameInForeground()) return;

    const mood = getEffectiveCombatMood();

    if (activeAmbientAudio && activeAmbientAudio.dataset?.combatMood === mood) {
        if (activeAmbientAudio.paused) {
            activeAmbientAudio.play().catch(() => {});
        }
        fadeAudioVolume(activeAmbientAudio, getAmbientTargetVolume(), 360);
        return;
    }

    const previousTrack = activeAmbientAudio;
    const nextTrack     = pickAmbientTrack(mood);
    if (!nextTrack) return;

    activeAmbientAudio     = nextTrack;
    nextTrack.loop         = true;
    nextTrack.currentTime  = 0;
    nextTrack.volume       = 0;

    nextTrack.play().catch(() => {
        if (activeAmbientAudio === nextTrack) activeAmbientAudio = null;
    });

    if (previousTrack && previousTrack !== nextTrack) {
        previousTrack.pause();
        previousTrack.currentTime = 0;
        previousTrack.volume      = 0;
    }

    fadeAudioVolume(nextTrack, getAmbientTargetVolume(), 520);
}

function pauseAmbientLoop() {
    clearAmbientFadeTimer();
    if (!activeAmbientAudio) return;
    activeAmbientAudio.pause();
    ambientPausedByFocusLoss = true;
}

function stopAmbientLoop() {
    clearAmbientFadeTimer();
    if (!activeAmbientAudio) return;
    const track      = activeAmbientAudio;
    track.volume     = 0;
    track.pause();
    track.currentTime       = 0;
    activeAmbientAudio      = null;
    ambientPausedByFocusLoss = false;
}

function isGameInForeground() {
    if (typeof document === 'undefined') return true;
    if (document.hidden) return false;
    if (typeof document.hasFocus === 'function') return document.hasFocus();
    return true;
}

function initializeAudioVisibilityGuard() {
    if (audioVisibilityGuardInitialized) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    audioVisibilityGuardInitialized = true;

    const sync = () => syncAmbientState();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);
    window.addEventListener('pageshow', sync);
    window.addEventListener('pagehide', sync);
    document.addEventListener('freeze', sync);
    document.addEventListener('resume', sync);
}

function syncAmbientState() {
    if (isMusicMuted() || !combatMusicEnabled) {
        stopAmbientLoop();
        return;
    }

    if (!isGameInForeground()) {
        pauseAmbientLoop();
        return;
    }

    if (ambientPausedByFocusLoss && activeAmbientAudio) {
        activeAmbientAudio.play().catch(() => {});
        fadeAudioVolume(activeAmbientAudio, getAmbientTargetVolume(), 280);
        ambientPausedByFocusLoss = false;
        return;
    }

    startAmbientLoop();
}

// ===============================
// MUSIQUE DE COMBAT ENNEMIE
// ===============================

/**
 * Lance la musique de combat associée à un ennemi.
 * Recherche un fichier .mp3 dont le nom contient la race normalisée de l'ennemi
 * (via window.TRACKS_LIST). Fallback sur une piste sweet.mp3 aléatoire.
 * Met en pause l'ambiance en cours et la restaure à l'arrêt.
 */
export async function playEnemyBattleMusic(enemy) {
    // Mémorise si une ambiance était active pour pouvoir la restaurer
    ambientWasPlayingBeforeBattle = Boolean(activeAmbientAudio);

    // Stoppe l'ambiance en cours
    if (activeAmbientAudio) {
        activeAmbientAudio.pause();
        activeAmbientAudio.currentTime = 0;
        activeAmbientAudio = null;
    }

    // Stoppe une éventuelle musique de combat précédente
    if (activeBattleMusicAudio) {
        activeBattleMusicAudio.pause();
        activeBattleMusicAudio.currentTime = 0;
        activeBattleMusicAudio = null;
    }

    if (!enemy || isMusicMuted()) return;

    // Recherche d'une piste .mp3 par race
    let src = null;
  
    const race = (enemy.race || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (race && Array.isArray(window.TRACKS_LIST)) {
        const match = window.TRACKS_LIST.find(f =>
            f.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(race)
        );
        if (match) src = './mp3/' + match;
    }

    // Fallback : piste sweet aléatoire
    if (!src) {
        const sweetTracks = AMBIENT_TRACKS_BY_MOOD.sweet;
        src = sweetTracks[Math.floor(Math.random() * sweetTracks.length)];
    }

    // Ajout du log du nom de la musique lue
    let musicName = src;
    if (src.startsWith('./wav/')) {
        musicName = src.replace('./wav/', '');
    } else if (src.startsWith('./mp3/')) {
        musicName = src.replace('./mp3/', '');
    }

    
    console.log(enemy.race )
    console.log('[MUSIQUE] Lecture :', src);
    const audio = await createAudio(src);

    // Volume : les .wav reçoivent un coefficient 0.5 par rapport au volume musique
    const baseVolume = getMusicVolume();
    audio.volume = src.endsWith('.wav') ? clampVolume(baseVolume * 0.5) : clampVolume(baseVolume);

    audio.play().catch(() => {});
    activeBattleMusicAudio = audio;
}

export function stopEnemyBattleMusic() {
    if (activeBattleMusicAudio) {
        activeBattleMusicAudio.pause();
        activeBattleMusicAudio.currentTime = 0;
        activeBattleMusicAudio = null;
    }
    // Relance l'ambiance si elle était active avant le combat
    if (ambientWasPlayingBeforeBattle) {
        ambientWasPlayingBeforeBattle = false;
        startAmbientLoop();
    }
}

// ===============================
// EXPORTS PUBLICS
// ===============================

export function setCombatMusicFamily(family) {
    combatMusicFamily = resolveCombatMusicFamily(family);
    syncAmbientState();
}

export function setCombatMusicMood(mood) {
    combatMusicMood = resolveCombatMusicMood(mood);
    syncAmbientState();
}

export function setCombatMusicEnabled(enabled) {
    combatMusicEnabled = Boolean(enabled);
    syncAmbientState();
}

export function primeAudioFromGesture() {
    audioPrimed = true;
    resumeAudioContext({ allowCreate: true });
    ensureAmbientAudioPool();
    syncAmbientState();
}

export function isMuted() {
    return getMuteMode() === 'all';
}

export function setMuted(muted) {
    applyMuteMode(Boolean(muted) ? 'all' : 'none');
    saveSettings();
    syncAmbientState();
}

export function toggleMuted() {
    const nextMode = getMuteMode() === 'all' ? 'none' : 'all';
    applyMuteMode(nextMode);
    saveSettings();
    syncAmbientState();
    return getMuteMode() === 'all';
}

export function updateAudioToggleButton(button) {
    if (!button) return;
    const mode  = getMuteMode();
    const icon  = mode === 'all' ? '🔇' : mode === 'music' ? '🎵' : mode === 'sfx' ? '🔕' : '🔊';
    const label = mode === 'all'   ? 'Tout coupé'       :
                  mode === 'music' ? 'Musique coupée'   :
                  mode === 'sfx'   ? 'Effets coupés'    : 'Son actif';
    button.textContent = icon;
    button.setAttribute('aria-pressed', mode === 'all' ? 'true' : 'false');
    button.title = `${label} (clic: ouvrir les options audio) • v${getMatch3Version()}`;
}

export function initializeAudioUI(button) {
    initializeAudioVisibilityGuard();
    loadSettings();
    updateAudioToggleButton(button);

    if (button) {
        button.addEventListener('click', () => {
            primeAudioFromGesture();
            playSfx('uiClick');
            openMuteModeChooser(button);
        });
    }
}

// ===============================
// EFFETS SONORES (SFX)
// ===============================

function tone(ctx, frequency, startAt, duration, gainValue, type = 'sine') {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, frequency), startAt);

    const attack      = Math.min(0.015, duration * 0.2);
    const releaseStart = Math.max(startAt + attack, startAt + duration - 0.03);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), startAt + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.04);
}

function playPattern(pattern, options = {}) {
    if (isSfxMuted()) return;

    const ctx = getAudioContext({ allowCreate: true });
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const baseTime = ctx.currentTime + 0.01;
    const baseGain = clampVolume((options.gain ?? 1) * getSfxVolume() * 0.12, defaultSettings.sfxVolume);

    pattern.forEach(([delay, frequency, duration, relGain = 1, wave = 'sine']) => {
        tone(ctx, frequency, baseTime + delay, duration, baseGain * relGain, wave);
    });
}

export function playSfx(eventName, payload = {}) {
    const len      = Math.max(3, Math.min(7, Number(payload.length) || 3));
    const isPlayer = payload.isPlayer !== false;

    switch (eventName) {
        case 'uiClick':
            playPattern([[0, 640, 0.07, 0.7, 'triangle']]);
            break;
        case 'toggleOn':
            playPattern([
                [0,    480, 0.06, 0.8, 'triangle'],
                [0.05, 720, 0.09, 1,   'triangle']
            ]);
            break;
        case 'swap':
            playPattern([
                [0,    380, 0.045, 0.7,  'square'],
                [0.04, 460, 0.045, 0.55, 'square']
            ]);
            break;
        case 'invalid':
            playPattern([
                [0,    220, 0.07, 0.75, 'sawtooth'],
                [0.04, 170, 0.08, 0.65, 'sawtooth']
            ]);
            break;
        case 'match': {
            const type = payload.matchType || 'color';
            const base = type === 'skull' ? 210 : type === 'combat' ? 300 : 520;
            const wave = type === 'color' ? 'triangle' : 'square';
            playPattern([
                [0,    base,            0.06, 0.7, wave],
                [0.05, base + len * 20, 0.09, 0.9, wave]
            ]);
            break;
        }
        case 'turnBonus':
            playPattern([
                [0,    520, 0.06, 0.7, 'triangle'],
                [0.05, 700, 0.06, 0.8, 'triangle'],
                [0.1,  900, 0.08, 1,   'triangle']
            ]);
            break;
        case 'spellCast':
            playPattern([
                [0,    430, 0.05, 0.55, 'sine'],
                [0.03, 560, 0.08, 0.8,  'triangle']
            ]);
            break;
        case 'spellHit':
            playPattern([
                [0,     isPlayer ? 760 : 300, 0.06, 0.75, 'square'],
                [0.035, isPlayer ? 620 : 220, 0.08, 0.7,  'sawtooth']
            ]);
            break;
        case 'heal':
            playPattern([
                [0,    430, 0.07, 0.65, 'sine'],
                [0.05, 560, 0.08, 0.8,  'sine'],
                [0.11, 720, 0.08, 0.95, 'sine']
            ]);
            break;
        case 'weaponHit':
            playPattern([
                [0,    isPlayer ? 210 : 180, 0.04, 0.8,  'square'],
                [0.03, isPlayer ? 150 : 130, 0.09, 0.75, 'sawtooth']
            ]);
            break;
        case 'victory':
            playPattern([
                [0,    520, 0.08, 0.75, 'triangle'],
                [0.08, 660, 0.08, 0.85, 'triangle'],
                [0.16, 880, 0.12, 1,    'triangle']
            ]);
            break;
        case 'defeat':
            playPattern([
                [0,    320, 0.1,  0.7,  'sawtooth'],
                [0.08, 240, 0.12, 0.85, 'sawtooth'],
                [0.18, 160, 0.18, 0.95, 'triangle']
            ]);
            break;
        default:
            playPattern([[0, 500, 0.05, 0.6, 'sine']]);
            break;
    }
}

// ===============================
// MODAL OPTIONS AUDIO
// ===============================

function openMuteModeChooser(button) {
    if (typeof document === 'undefined') return;

    document.getElementById('audio-mode-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'audio-mode-modal';
    Object.assign(overlay.style, {
        position: 'fixed', inset: '0',
        background: 'rgba(5, 10, 18, 0.7)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: '9999'
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
        width: 'min(92vw, 420px)',
        background: 'linear-gradient(180deg, #1a2335 0%, #111827 100%)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '14px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
        padding: '18px',
        color: '#f3f5f8',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        maxHeight: '88vh',
        overflowY: 'auto'
    });

    let devModeClickCount = 0;

    // --- Titre ---
    const title       = document.createElement('h3');
    title.style.cssText = 'margin:0 0 8px;font-size:1.05rem';
    const titleEmoji  = document.createElement('span');
    titleEmoji.textContent = '🔊';
    titleEmoji.style.cssText = 'cursor:pointer;user-select:none;margin-right:6px';
    const titleText   = document.createElement('span');
    titleText.textContent = 'Audio';
    title.append(titleEmoji, titleText);

    const subtitle = document.createElement('p');
    subtitle.style.cssText = 'margin:0 0 14px;opacity:.85;font-size:.92rem';
    subtitle.textContent = 'Choisis ce que tu veux couper et ajuste les volumes.';

    const versionBadge = document.createElement('div');
    versionBadge.textContent = `Match3 v${getMatch3Version()}`;
    versionBadge.style.cssText = 'margin:0 0 12px;opacity:.72;font-size:.78rem;letter-spacing:.05em';

    const refreshSubtitle = () => {
        if (settings.developerMode) return;
        const remaining = DEV_MODE_CLICK_TARGET - devModeClickCount;
        subtitle.textContent = remaining > 0
            ? `Choisis ce que tu veux couper et ajuste les volumes. (Mode développeur: ${devModeClickCount}/${DEV_MODE_CLICK_TARGET})`
            : 'Choisis ce que tu veux couper et ajuste les volumes.';
    };

    // --- Section audio ---
    const sectionAudio = document.createElement('div');
    sectionAudio.style.marginBottom = '14px';

    const sectionAudioTitle = document.createElement('div');
    sectionAudioTitle.textContent = 'Audio';
    sectionAudioTitle.style.cssText = 'font-size:.8rem;letter-spacing:.08em;opacity:.75;text-transform:uppercase;margin-bottom:8px';
    sectionAudio.appendChild(sectionAudioTitle);

    const muteOptions = [
        { mode: 'music', label: 'Couper la musique', hint: 'Garde les effets audio' },
        { mode: 'sfx',   label: 'Couper les effets', hint: 'Garde la musique' },
        { mode: 'all',   label: 'Couper les deux',   hint: 'Silence total' },
        { mode: 'none',  label: 'Tout activer',       hint: 'Musique + effets audio' }
    ];

    const currentMode = getMuteMode();
    const buttonWrap  = document.createElement('div');
    buttonWrap.style.cssText = 'display:grid;gap:8px';

    const closeModal = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (e) => { if (e.key === 'Escape') closeModal(); };

    muteOptions.forEach(({ mode, label, hint }) => {
        const btn      = document.createElement('button');
        const isActive = mode === currentMode;
        btn.type = 'button';
        Object.assign(btn.style, {
            textAlign: 'left',
            background: isActive ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.08)',
            border: isActive ? '1px solid rgba(147, 197, 253, 0.85)' : '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px', padding: '10px 12px', color: '#f3f5f8', cursor: 'pointer'
        });
        btn.innerHTML = `<strong>${label}</strong><br><span style="opacity:.78;font-size:.85rem">${hint}</span>`;
        btn.addEventListener('click', () => {
            applyMuteMode(mode);
            saveSettings();
            syncAmbientState();
            updateAudioToggleButton(button);
            closeModal();
        });
        buttonWrap.appendChild(btn);
    });

    sectionAudio.appendChild(buttonWrap);

    // --- Sliders de volume ---
    const volumeControls = document.createElement('div');
    volumeControls.style.cssText = 'display:grid;gap:10px;margin-top:12px';

    const createVolumeControl = ({ label, hint, initialValue, onInput, onChange }) => {
        const wrap = document.createElement('label');
        Object.assign(wrap.style, {
            display: 'grid', gap: '6px', padding: '10px 12px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px'
        });

        const header     = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px';

        const titleWrap  = document.createElement('div');
        const titleEl    = document.createElement('strong');
        titleEl.textContent = label;
        const hintEl     = document.createElement('div');
        hintEl.textContent  = hint;
        hintEl.style.cssText = 'opacity:.72;font-size:.82rem;margin-top:2px';
        titleWrap.append(titleEl, hintEl);

        const valueLabel = document.createElement('span');
        valueLabel.style.cssText = 'font-variant-numeric:tabular-nums;opacity:.88;font-size:.9rem';

        const slider = document.createElement('input');
        slider.type  = 'range';
        slider.min   = '0'; slider.max = '100'; slider.step = '1';
        slider.value = String(Math.round(clampVolume(initialValue) * 100));
        slider.style.cssText = 'width:100%;cursor:pointer;accent-color:#93c5fd';

        const refreshValue = () => { valueLabel.textContent = `${slider.value}%`; };
        slider.addEventListener('input', () => { refreshValue(); onInput(Number(slider.value) / 100); });
        slider.addEventListener('change', () => { onChange?.(); });
        refreshValue();

        header.append(titleWrap, valueLabel);
        wrap.append(header, slider);
        return wrap;
    };

    volumeControls.appendChild(createVolumeControl({
        label: 'Musique', hint: 'Volume de l\'ambiance et du combat',
        initialValue: getMusicVolume(),
        onInput: (value) => { setMusicVolume(value); saveSettings(); syncAmbientState(); }
    }));

    volumeControls.appendChild(createVolumeControl({
        label: 'Effets', hint: 'Volume des clics, matchs et attaques',
        initialValue: getSfxVolume(),
        onInput: (value) => { setSfxVolume(value); saveSettings(); },
        onChange: () => { playSfx('uiClick'); }
    }));

    sectionAudio.appendChild(volumeControls);

    // --- Section cheat (développeur) ---
    const sectionCheat    = createCheatModeSection({
        isEnabled: () => Boolean(settings.cheatMode) && Boolean(settings.developerMode),
        setEnabled: (enabled) => {
            if (!settings.developerMode) return;
            settings.cheatMode = Boolean(enabled);
            saveSettings();
        },
        onCheatApplied: () => { closeModal(); }
    });

    const cheatSectionWrap = document.createElement('div');
    const renderCheatSection = () => {
        cheatSectionWrap.innerHTML = '';
        if (settings.developerMode) cheatSectionWrap.appendChild(sectionCheat);
    };

    titleEmoji.addEventListener('click', () => {
        if (settings.developerMode) return;
        devModeClickCount = Math.min(DEV_MODE_CLICK_TARGET, devModeClickCount + 1);
        if (devModeClickCount >= DEV_MODE_CLICK_TARGET) {
            settings.developerMode = true;
            saveSettings();
            renderCheatSection();
            subtitle.textContent = 'Mode développeur activé.';
            return;
        }
        refreshSubtitle();
    });

    // --- Footer ---
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;margin-top:12px';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Fermer';
    cancel.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,.35);border-radius:8px;color:#f3f5f8;padding:8px 12px;cursor:pointer';
    cancel.addEventListener('click', closeModal);
    footer.appendChild(cancel);

    panel.append(title, subtitle, versionBadge, sectionAudio, cheatSectionWrap, footer);
    overlay.appendChild(panel);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeyDown);
    refreshSubtitle();
    renderCheatSection();
}
