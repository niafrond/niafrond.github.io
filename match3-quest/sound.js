import { icon } from "./icons.js";
import { createCheatModeSection } from "./cheatMode.js";
import { getMatch3Version } from "./version.js";
import { sfxKeyFor, sfxGainFor, sfxVariants, sfxUrl, SFX_PLAY_GAIN } from "./sfxCatalog.js";

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

// Durée du jingle d'entrée en combat : la musique de combat démarre après ce délai.
export const COMBAT_INTRO_MS = 1400;

const DEV_MODE_CLICK_TARGET = 6;

// ===============================
// ÉTAT GLOBAL
// ===============================

let settings = { ...defaultSettings };
let audioContext = null;
let audioPrimed = false;

// ===============================
// UTILITAIRES VOLUME / PARAMÈTRES
// ===============================

function clampVolume(v, fallback = defaultSettings.volume) {
    return Math.max(0, Math.min(1, Number.isFinite(v) ? v : fallback));
}

function isStoredVolume(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function getMusicVolume() {
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

export function isMusicMuted() {
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

// Contexte audio partagé (créé après un geste utilisateur) : sert aussi à la lecture de la musique pré-enregistrée (music.js).
export const getSharedAudioContext = () => getAudioContext({ allowCreate: true });

// Appareil modeste (peu de cœurs / de mémoire) : on demande un tampon audio plus large au navigateur. Le son est
// strictement le même (même synthèse, même fréquence d'échantillonnage) mais le fil audio a plus de marge, ce qui
// supprime les craquements / coupures quand le processeur est saturé par le rendu du jeu.
function isLowEndDevice() {
    if (typeof navigator === 'undefined') return false;
    const cores = Number(navigator.hardwareConcurrency);
    const mem = Number(navigator.deviceMemory);
    return (Number.isFinite(cores) && cores > 0 && cores <= 4) || (Number.isFinite(mem) && mem > 0 && mem <= 2);
}

function createContext(Ctor) {
    if (isLowEndDevice()) {
        try { return new Ctor({ latencyHint: 0.15 }); } catch { /* option non supportée : défaut */ }
    }
    return new Ctor();
}

function getAudioContext(options = {}) {
    const { allowCreate = true } = options;
    if (typeof window === 'undefined') return null;
    if (audioContext) return audioContext;
    if (!allowCreate || !audioPrimed) return null;

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;

    audioContext = createContext(Ctor);
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
// EXPORTS PUBLICS
// ===============================

export function primeAudioFromGesture() {
    audioPrimed = true;
    resumeAudioContext({ allowCreate: true });
}

export function isMuted() {
    return getMuteMode() === 'all';
}

export function setMuted(muted) {
    applyMuteMode(Boolean(muted) ? 'all' : 'none');
    saveSettings();
}

export function toggleMuted() {
    const nextMode = getMuteMode() === 'all' ? 'none' : 'all';
    applyMuteMode(nextMode);
    saveSettings();
    return getMuteMode() === 'all';
}

export function updateAudioToggleButton(button) {
    if (!button) return;
    const mode  = getMuteMode();
    const iconName = mode === 'all' ? 'soundOff' : mode === 'sfx' ? 'music' : 'soundOn';
    const label = mode === 'all'   ? 'Tout coupé'       :
                  mode === 'music' ? 'Musique coupée'   :
                  mode === 'sfx'   ? 'Effets coupés'    : 'Son actif';
    button.innerHTML = icon(iconName);
    button.setAttribute('aria-pressed', mode === 'all' ? 'true' : 'false');
    button.title = `${label} (clic: ouvrir les options audio) • v${getMatch3Version()}`;
}

export function initializeAudioUI(button) {
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
// EFFETS SONORES (SFX) : clips MP3 pré-enregistrés (audio/sfx/), rendus par tools/audio/render.mjs
// ===============================

const sfxBuffers = new Map();   // clé -> AudioBuffer décodé
const sfxLoading = new Map();   // clé -> Promise (téléchargement en cours)
const sfxFailed = new Map();    // clé -> instant du dernier échec (nouvel essai après SFX_RETRY_MS)
const SFX_RETRY_MS = 10000;
const MAX_SFX_VOICES = 24;
let activeSfx = 0;
let sfxPreloadStarted = false;

function loadSfx(ctx, key) {
    if (sfxBuffers.has(key)) return Promise.resolve(sfxBuffers.get(key));
    if (sfxLoading.has(key)) return sfxLoading.get(key);
    if (sfxFailed.has(key) && Date.now() - sfxFailed.get(key) < SFX_RETRY_MS) return Promise.resolve(null);
    if (typeof fetch !== 'function') return Promise.resolve(null);
    const promise = (async () => {
        try {
            const res = await fetch(new URL(sfxUrl(key), import.meta.url).href);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.arrayBuffer();
            const buf = await new Promise((resolve, reject) => {
                const p = ctx.decodeAudioData(data, resolve, reject);   // Safari ancien : callbacks
                if (p && typeof p.then === 'function') p.then(resolve, reject);
            });
            sfxBuffers.set(key, buf);
            return buf;
        } catch {
            sfxFailed.set(key, Date.now());
            return null;
        } finally {
            sfxLoading.delete(key);
        }
    })();
    sfxLoading.set(key, promise);
    return promise;
}

// Charge tous les clips (petits : quelques dizaines de Ko chacun) dès que l'audio est débloqué par un geste.
function preloadSfx() {
    if (sfxPreloadStarted) return;
    const ctx = getAudioContext({ allowCreate: true });
    if (!ctx) return;
    sfxPreloadStarted = true;
    sfxVariants().forEach(v => { loadSfx(ctx, v.key); });
}

function playBuffer(ctx, buffer, volume) {
    if (activeSfx >= MAX_SFX_VOICES) return;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = volume;
    activeSfx++;
    src.onended = () => { activeSfx = Math.max(0, activeSfx - 1); try { src.disconnect(); gain.disconnect(); } catch { /* déjà déconnecté */ } };
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
}

export function playSfx(eventName, payload = {}) {
    if (isSfxMuted()) return;
    const ctx = getAudioContext({ allowCreate: true });
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    preloadSfx();
    const key = sfxKeyFor(eventName, payload);
    const volume = clampVolume(getSfxVolume(), defaultSettings.sfxVolume) * SFX_PLAY_GAIN * sfxGainFor(eventName, payload);
    const buffer = sfxBuffers.get(key);
    if (buffer) { playBuffer(ctx, buffer, volume); return; }
    // Pas encore chargé (tout premier son) : on le joue dès qu'il arrive, s'il n'est pas trop tard.
    const asked = Date.now();
    loadSfx(ctx, key).then(buf => { if (buf && Date.now() - asked < 800 && !isSfxMuted()) playBuffer(ctx, buf, volume); });
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
    titleEmoji.innerHTML = icon('soundOn');
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
        onInput: (value) => { setMusicVolume(value); saveSettings(); }
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
