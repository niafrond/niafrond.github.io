import { createCheatModeSection } from "./cheatMode.js";
import { getMatch3Version } from "./version.js";

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

let settings = { ...defaultSettings };
let audioContext = null;
let ambientAudioByMood = null;
let activeAmbientAudio = null;
let ambientFadeTimerId = null;
let combatMusicEnabled = false;
let audioPrimed = false;
let combatMusicFamily = 'default';
let combatMusicMood = 'sweet';
let audioVisibilityGuardInitialized = false;
let ambientPausedByFocusLoss = false;

const AMBIENT_TRACKS_BY_MOOD = {
    sweet: ['./mp3/sweet.mp3', './mp3/sweet2.mp3'],
    epic: ['./mp3/epic.mp3', './mp3/epic2.mp3']
};

const AMBIENT_VOLUME_BY_MOOD = {
    sweet: 0.52,
    epic: 0.66
};

const AMBIENT_MOOD_BY_FAMILY = {
    default: 'sweet',
    dragon: 'epic',
    elemental: 'epic',
    monster: 'epic',
    troll: 'epic',
    construct: 'epic',
    undead: 'epic',
    vampire: 'epic'
};

const AMBIENT_RACE_ALIASES = {
    dragon: 'dragon',
    vampire: 'vampire',
    orc: 'orc',
    construct: 'construct',
    'mort-vivant': 'undead',
    'mort vivant': 'undead',
    mortvivant: 'undead',
    gobelin: 'goblin',
    goblin: 'goblin',
    elementaire: 'elemental',
    elemental: 'elemental',
    humain: 'human',
    human: 'human',
    esprit: 'spirit',
    spirit: 'spirit',
    elfe: 'elf',
    elf: 'elf',
    monstre: 'monster',
    monster: 'monster',
    troll: 'troll'
};
const LONG_PRESS_MS = 550;
const DEV_MODE_CLICK_TARGET = 6;

function normalizeCombatFamilyName(value) {
    if(typeof value !== 'string') return '';

    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_]+/g, ' ')
        .replace(/[^\w\s-]/g, '')
        .trim();
}

function resolveCombatMusicFamily(value) {
    const normalized = normalizeCombatFamilyName(value);
    if(!normalized) return 'default';

    const mapped = AMBIENT_RACE_ALIASES[normalized] || normalized;
    return Object.prototype.hasOwnProperty.call(AMBIENT_MOOD_BY_FAMILY, mapped) ? mapped : 'default';
}

function resolveCombatMusicMood(value) {
    if(typeof value !== 'string') return 'sweet';
    const normalized = value.toLowerCase().trim();
    return normalized === 'epic' ? 'epic' : 'sweet';
}

function getEffectiveCombatMood() {
    return combatMusicMood === 'epic' ? 'epic' : 'sweet';
}

function isStoredVolume(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
}

function syncLegacyVolumeSetting() {
    settings.volume = clampVolume((settings.musicVolume + settings.sfxVolume) / 2);
}

function loadSettings() {
    try {
        const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
        if(!raw) return;
        const parsed = JSON.parse(raw);
        const legacyMuted = Boolean(parsed?.muted);
        const hasSplitFlags = typeof parsed?.mutedMusic === 'boolean' || typeof parsed?.mutedSfx === 'boolean';

        if(hasSplitFlags) {
            settings.mutedMusic = Boolean(parsed?.mutedMusic);
            settings.mutedSfx = Boolean(parsed?.mutedSfx);
            settings.muted = settings.mutedMusic && settings.mutedSfx;
        } else {
            settings.muted = legacyMuted;
            settings.mutedMusic = legacyMuted;
            settings.mutedSfx = legacyMuted;
        }

        const parsedVolume = Number(parsed?.volume);
        const legacyVolume = isStoredVolume(parsedVolume) ? parsedVolume : defaultSettings.volume;
        const parsedMusicVolume = Number(parsed?.musicVolume);
        const parsedSfxVolume = Number(parsed?.sfxVolume);

        settings.musicVolume = isStoredVolume(parsedMusicVolume) ? parsedMusicVolume : legacyVolume;
        settings.sfxVolume = isStoredVolume(parsedSfxVolume) ? parsedSfxVolume : legacyVolume;
        syncLegacyVolumeSetting();

        settings.developerMode = Boolean(parsed?.developerMode);
        settings.cheatMode = Boolean(parsed?.cheatMode);
        if(!settings.developerMode) {
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
        // Ignore storage errors (private mode or quota).
    }
}

function getAudioContext(options = {}) {
    const { allowCreate = true } = options;
    if(typeof window === 'undefined') return null;
    if(audioContext) return audioContext;
    if(!allowCreate || !audioPrimed) return null;

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if(!Ctor) return null;

    audioContext = new Ctor();
    return audioContext;
}

function resumeAudioContext(options = {}) {
    const ctx = getAudioContext(options);
    if(!ctx) return;
    if(ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }
}

function clampVolume(v, fallback = defaultSettings.volume) {
    return Math.max(0, Math.min(1, Number.isFinite(v) ? v : fallback));
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

function isMusicMuted() {
    return Boolean(settings.mutedMusic || settings.muted);
}

function isSfxMuted() {
    return Boolean(settings.mutedSfx || settings.muted);
}

function getMuteMode() {
    const musicMuted = isMusicMuted();
    const sfxMuted = isSfxMuted();
    if(musicMuted && sfxMuted) return 'all';
    if(musicMuted) return 'music';
    if(sfxMuted) return 'sfx';
    return 'none';
}

function applyMuteMode(mode) {
    switch(mode) {
        case 'all':
            settings.mutedMusic = true;
            settings.mutedSfx = true;
            break;
        case 'music':
            settings.mutedMusic = true;
            settings.mutedSfx = false;
            break;
        case 'sfx':
            settings.mutedMusic = false;
            settings.mutedSfx = true;
            break;
        default:
            settings.mutedMusic = false;
            settings.mutedSfx = false;
            break;
    }

    settings.muted = settings.mutedMusic && settings.mutedSfx;
}

function openMuteModeChooser(button) {
    if(typeof document === 'undefined') return;

    const existing = document.getElementById('audio-mode-modal');
    if(existing) {
        existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'audio-mode-modal';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(5, 10, 18, 0.7)';
    overlay.style.backdropFilter = 'blur(2px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const panel = document.createElement('div');
    panel.style.width = 'min(92vw, 420px)';
    panel.style.background = 'linear-gradient(180deg, #1a2335 0%, #111827 100%)';
    panel.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    panel.style.borderRadius = '14px';
    panel.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.45)';
    panel.style.padding = '18px';
    panel.style.color = '#f3f5f8';
    panel.style.fontFamily = 'system-ui, -apple-system, Segoe UI, sans-serif';
    panel.style.maxHeight = '88vh';
    panel.style.overflowY = 'auto';

    let devModeClickCount = 0;

    const title = document.createElement('h3');
    title.style.margin = '0 0 8px';
    title.style.fontSize = '1.05rem';

    const titleEmoji = document.createElement('span');
    titleEmoji.textContent = '🔊';
    titleEmoji.style.cursor = 'pointer';
    titleEmoji.style.userSelect = 'none';
    titleEmoji.style.marginRight = '6px';

    const titleText = document.createElement('span');
    titleText.textContent = 'Audio';

    title.appendChild(titleEmoji);
    title.appendChild(titleText);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Choisis ce que tu veux couper et ajuste les volumes.';
    subtitle.style.margin = '0 0 14px';
    subtitle.style.opacity = '0.85';
    subtitle.style.fontSize = '0.92rem';

    const versionBadge = document.createElement('div');
    versionBadge.textContent = `Match3 v${getMatch3Version()}`;
    versionBadge.style.margin = '0 0 12px';
    versionBadge.style.opacity = '0.72';
    versionBadge.style.fontSize = '0.78rem';
    versionBadge.style.letterSpacing = '.05em';

    const refreshSubtitle = () => {
        if(settings.developerMode) {
            subtitle.textContent = 'Choisis ce que tu veux couper et ajuste les volumes.';
            return;
        }

        const remaining = Math.max(0, DEV_MODE_CLICK_TARGET - devModeClickCount);
        subtitle.textContent = remaining > 0
            ? `Choisis ce que tu veux couper et ajuste les volumes. (Mode developpeur: ${devModeClickCount}/${DEV_MODE_CLICK_TARGET})`
            : 'Choisis ce que tu veux couper et ajuste les volumes.';
    };

    const sectionAudio = document.createElement('div');
    sectionAudio.style.marginBottom = '14px';

    const sectionAudioTitle = document.createElement('div');
    sectionAudioTitle.textContent = 'Audio';
    sectionAudioTitle.style.fontSize = '0.8rem';
    sectionAudioTitle.style.letterSpacing = '.08em';
    sectionAudioTitle.style.opacity = '0.75';
    sectionAudioTitle.style.textTransform = 'uppercase';
    sectionAudioTitle.style.marginBottom = '8px';
    sectionAudio.appendChild(sectionAudioTitle);

    const options = [
        { mode: 'music', label: 'Couper la musique', hint: 'Garde les effets audio' },
        { mode: 'sfx', label: 'Couper les effets', hint: 'Garde la musique' },
        { mode: 'all', label: 'Couper les deux', hint: 'Silence total' },
        { mode: 'none', label: 'Tout activer', hint: 'Musique + effets audio' }
    ];

    const currentMode = getMuteMode();
    const buttonWrap = document.createElement('div');
    buttonWrap.style.display = 'grid';
    buttonWrap.style.gap = '8px';

    const volumeControls = document.createElement('div');
    volumeControls.style.display = 'grid';
    volumeControls.style.gap = '10px';
    volumeControls.style.marginTop = '12px';

    const createVolumeControl = ({ label, hint, initialValue, onInput, onChange }) => {
        const wrap = document.createElement('label');
        wrap.style.display = 'grid';
        wrap.style.gap = '6px';
        wrap.style.padding = '10px 12px';
        wrap.style.background = 'rgba(255, 255, 255, 0.06)';
        wrap.style.border = '1px solid rgba(255, 255, 255, 0.12)';
        wrap.style.borderRadius = '10px';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.style.gap = '12px';

        const titleWrap = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = label;
        titleWrap.appendChild(title);

        const hintText = document.createElement('div');
        hintText.textContent = hint;
        hintText.style.opacity = '0.72';
        hintText.style.fontSize = '0.82rem';
        hintText.style.marginTop = '2px';
        titleWrap.appendChild(hintText);

        const valueLabel = document.createElement('span');
        valueLabel.style.fontVariantNumeric = 'tabular-nums';
        valueLabel.style.opacity = '0.88';
        valueLabel.style.fontSize = '0.9rem';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.step = '1';
        slider.value = String(Math.round(clampVolume(initialValue) * 100));
        slider.style.width = '100%';
        slider.style.cursor = 'pointer';
        slider.style.accentColor = '#93c5fd';

        const refreshValue = () => {
            valueLabel.textContent = `${slider.value}%`;
        };

        slider.addEventListener('input', () => {
            refreshValue();
            onInput(Number(slider.value) / 100);
        });

        slider.addEventListener('change', () => {
            onChange?.();
        });

        refreshValue();
        header.appendChild(titleWrap);
        header.appendChild(valueLabel);
        wrap.appendChild(header);
        wrap.appendChild(slider);
        return wrap;
    };

    const closeModal = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (event) => {
        if(event.key === 'Escape') {
            closeModal();
        }
    };

    options.forEach((option) => {
        const optionBtn = document.createElement('button');
        const isActive = option.mode === currentMode;
        optionBtn.type = 'button';
        optionBtn.style.textAlign = 'left';
        optionBtn.style.background = isActive ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.08)';
        optionBtn.style.border = isActive ? '1px solid rgba(147, 197, 253, 0.85)' : '1px solid rgba(255, 255, 255, 0.12)';
        optionBtn.style.borderRadius = '10px';
        optionBtn.style.padding = '10px 12px';
        optionBtn.style.color = '#f3f5f8';
        optionBtn.style.cursor = 'pointer';
        optionBtn.innerHTML = `<strong>${option.label}</strong><br><span style="opacity:.78;font-size:.85rem">${option.hint}</span>`;

        optionBtn.addEventListener('click', () => {
            applyMuteMode(option.mode);
            saveSettings();
            syncAmbientState();
            updateAudioToggleButton(button);
            closeModal();
        });

        buttonWrap.appendChild(optionBtn);
    });

    sectionAudio.appendChild(buttonWrap);

    volumeControls.appendChild(createVolumeControl({
        label: 'Musique',
        hint: 'Volume de l\'ambiance de combat',
        initialValue: getMusicVolume(),
        onInput: (value) => {
            setMusicVolume(value);
            saveSettings();
            syncAmbientState();
        }
    }));

    volumeControls.appendChild(createVolumeControl({
        label: 'Effets',
        hint: 'Volume des clics, matchs et attaques',
        initialValue: getSfxVolume(),
        onInput: (value) => {
            setSfxVolume(value);
            saveSettings();
        },
        onChange: () => {
            playSfx('uiClick');
        }
    }));

    sectionAudio.appendChild(volumeControls);

    const sectionCheat = createCheatModeSection({
        isEnabled: () => Boolean(settings.cheatMode) && Boolean(settings.developerMode),
        setEnabled: (enabled) => {
            if(!settings.developerMode) return;
            settings.cheatMode = Boolean(enabled);
            saveSettings();
        },
        onCheatApplied: () => {
            closeModal();
        }
    });

    const cheatSectionWrap = document.createElement('div');

    const renderCheatSection = () => {
        cheatSectionWrap.innerHTML = '';
        if(settings.developerMode) {
            cheatSectionWrap.appendChild(sectionCheat);
        }
    };

    titleEmoji.addEventListener('click', () => {
        if(settings.developerMode) return;

        devModeClickCount = Math.min(DEV_MODE_CLICK_TARGET, devModeClickCount + 1);
        if(devModeClickCount >= DEV_MODE_CLICK_TARGET) {
            settings.developerMode = true;
            saveSettings();
            renderCheatSection();
            subtitle.textContent = 'Choisis ce que tu veux couper et ajuste les volumes. Mode developpeur active.';
            return;
        }

        refreshSubtitle();
    });

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.marginTop = '12px';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Fermer';
    cancel.style.background = 'transparent';
    cancel.style.border = '1px solid rgba(255, 255, 255, 0.35)';
    cancel.style.borderRadius = '8px';
    cancel.style.color = '#f3f5f8';
    cancel.style.padding = '8px 12px';
    cancel.style.cursor = 'pointer';
    cancel.addEventListener('click', closeModal);
    footer.appendChild(cancel);

    panel.appendChild(title);
    panel.appendChild(subtitle);
    panel.appendChild(versionBadge);
    panel.appendChild(sectionAudio);
    panel.appendChild(cheatSectionWrap);
    panel.appendChild(footer);
    overlay.appendChild(panel);

    overlay.addEventListener('click', (event) => {
        if(event.target === overlay) {
            closeModal();
        }
    });

    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeyDown);
    refreshSubtitle();
    renderCheatSection();
}

function tone(ctx, frequency, startAt, duration, gainValue, type = 'sine') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, frequency), startAt);

    const attack = Math.min(0.015, duration * 0.2);
    const releaseStart = Math.max(startAt + attack, startAt + duration - 0.03);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), startAt + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.04);
}

function ensureAmbientAudioPool() {
    if(typeof Audio === 'undefined') return null;
    if(ambientAudioByMood) return ambientAudioByMood;

    ambientAudioByMood = {};
    Object.entries(AMBIENT_TRACKS_BY_MOOD).forEach(([mood, tracks]) => {
        ambientAudioByMood[mood] = tracks.map((src) => {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.loop = true;
            audio.volume = 0;
            audio.dataset.combatMood = mood;
            return audio;
        });
    });

    return ambientAudioByMood;
}

function getAmbientTargetVolume() {
    const mood = getEffectiveCombatMood();
    const moodMultiplier = AMBIENT_VOLUME_BY_MOOD[mood] ?? 0.52;
    return clampVolume(getMusicVolume() * moodMultiplier, defaultSettings.musicVolume);
}

function clearAmbientFadeTimer() {
    if(ambientFadeTimerId !== null) {
        window.clearInterval(ambientFadeTimerId);
        ambientFadeTimerId = null;
    }
}

function fadeAudioVolume(audio, target, durationMs = 420) {
    if(!audio) return;

    clearAmbientFadeTimer();

    const start = Number.isFinite(audio.volume) ? audio.volume : 0;
    const end = clampVolume(target);
    const duration = Math.max(1, Number(durationMs) || 1);
    const startedAt = Date.now();

    if(Math.abs(start - end) < 0.01) {
        audio.volume = end;
        return;
    }

    ambientFadeTimerId = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const ratio = Math.min(1, elapsed / duration);
        audio.volume = clampVolume(start + ((end - start) * ratio));

        if(ratio >= 1) {
            clearAmbientFadeTimer();
        }
    }, 30);
}

function pickAmbientTrack(mood) {
    const pool = ensureAmbientAudioPool();
    const tracks = pool?.[mood];
    if(!Array.isArray(tracks) || tracks.length === 0) return null;

    let nextTrack = tracks[Math.floor(Math.random() * tracks.length)];
    if(
        tracks.length > 1 &&
        activeAmbientAudio &&
        tracks.includes(activeAmbientAudio)
    ) {
        const currentIndex = tracks.indexOf(activeAmbientAudio);
        const offset = 1 + Math.floor(Math.random() * (tracks.length - 1));
        nextTrack = tracks[(currentIndex + offset) % tracks.length];
    }

    return nextTrack;
}

function startAmbientLoop() {
    if(isMusicMuted() || !combatMusicEnabled || !audioPrimed) return;
    if(!isGameInForeground()) return;

    const mood = getEffectiveCombatMood();

    if(activeAmbientAudio && activeAmbientAudio.dataset?.combatMood === mood) {
        if(activeAmbientAudio.paused) {
            const playPromise = activeAmbientAudio.play();
            if(playPromise?.catch) {
                playPromise.catch(() => {});
            }
        }
        fadeAudioVolume(activeAmbientAudio, getAmbientTargetVolume(), 360);
        return;
    }

    const previousTrack = activeAmbientAudio;
    const nextTrack = pickAmbientTrack(mood);
    if(!nextTrack) return;

    activeAmbientAudio = nextTrack;
    nextTrack.loop = true;
    nextTrack.currentTime = 0;
    nextTrack.volume = 0;

    const playPromise = nextTrack.play();
    if(playPromise?.catch) {
        playPromise.catch(() => {
            if(activeAmbientAudio === nextTrack) {
                activeAmbientAudio = null;
            }
        });
    }

    if(previousTrack && previousTrack !== nextTrack) {
        previousTrack.pause();
        previousTrack.currentTime = 0;
        previousTrack.volume = 0;
    }

    fadeAudioVolume(nextTrack, getAmbientTargetVolume(), 520);
}

function pauseAmbientLoop() {
    clearAmbientFadeTimer();

    if(!activeAmbientAudio) return;

    activeAmbientAudio.pause();
    ambientPausedByFocusLoss = true;
}

function stopAmbientLoop() {
    clearAmbientFadeTimer();

    if(!activeAmbientAudio) return;

    const trackToStop = activeAmbientAudio;
    trackToStop.volume = 0;
    trackToStop.pause();
    trackToStop.currentTime = 0;
    activeAmbientAudio = null;
    ambientPausedByFocusLoss = false;
}

function isGameInForeground() {
    if(typeof document === 'undefined') return true;
    if(document.hidden) return false;
    if(typeof document.hasFocus === 'function') {
        return document.hasFocus();
    }
    return true;
}

function initializeAudioVisibilityGuard() {
    if(audioVisibilityGuardInitialized) return;
    if(typeof window === 'undefined' || typeof document === 'undefined') return;

    audioVisibilityGuardInitialized = true;
    const syncFromVisibility = () => syncAmbientState();
    document.addEventListener('visibilitychange', syncFromVisibility);
    window.addEventListener('focus', syncFromVisibility);
    window.addEventListener('blur', syncFromVisibility);
    // Mobile/PWA lifecycle events (iOS Safari, Android Chrome)
    window.addEventListener('pageshow', syncFromVisibility);
    window.addEventListener('pagehide', syncFromVisibility);
    document.addEventListener('freeze', syncFromVisibility);
    document.addEventListener('resume', syncFromVisibility);
}

function syncAmbientState() {
    if(isMusicMuted() || !combatMusicEnabled) {
        stopAmbientLoop();
        return;
    }

    if(!isGameInForeground()) {
        pauseAmbientLoop();
        return;
    }

    if(ambientPausedByFocusLoss && activeAmbientAudio) {
        const playPromise = activeAmbientAudio.play();
        if(playPromise?.catch) {
            playPromise.catch(() => {});
        }
        fadeAudioVolume(activeAmbientAudio, getAmbientTargetVolume(), 280);
        ambientPausedByFocusLoss = false;
        return;
    }

    startAmbientLoop();
}

export function setCombatMusicFamily(family) {
    const resolvedFamily = resolveCombatMusicFamily(family);
    combatMusicFamily = resolvedFamily;
    syncAmbientState();
}

export function setCombatMusicMood(mood) {
    const resolvedMood = resolveCombatMusicMood(mood);
    combatMusicMood = resolvedMood;
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

function playPattern(pattern, options = {}) {
    if(isSfxMuted()) return;

    const ctx = getAudioContext({ allowCreate: true });
    if(!ctx) return;
    if(ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }

    const baseTime = ctx.currentTime + 0.01;
    const baseGain = clampVolume((options.gain ?? 1) * getSfxVolume() * 0.12, defaultSettings.sfxVolume);

    pattern.forEach((step) => {
        const [delay, frequency, duration, relGain = 1, wave = 'sine'] = step;
        tone(ctx, frequency, baseTime + delay, duration, baseGain * relGain, wave);
    });
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
    if(!button) return;
    const mode = getMuteMode();
    const icon = mode === 'all' ? '🔇' : mode === 'music' ? '🎵' : mode === 'sfx' ? '🔕' : '🔊';
    const title = mode === 'all'
        ? 'Tout coupe (clic: tout activer, maintien: options audio)'
        : mode === 'music'
            ? 'Musique coupee (maintien: options audio)'
            : mode === 'sfx'
                ? 'Effets coupes (maintien: options audio)'
                : 'Son actif (clic: tout couper, maintien: options audio)';

    button.textContent = icon;
    button.setAttribute('aria-pressed', mode === 'all' ? 'true' : 'false');
    button.title = `${title} • v${getMatch3Version()}`;
}

export function initializeAudioUI(button) {
    initializeAudioVisibilityGuard();
    loadSettings();
    updateAudioToggleButton(button);

    if(button) {
        let pressTimer = null;
        let longPressTriggered = false;

        const clearPressTimer = () => {
            if(pressTimer !== null) {
                window.clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        button.addEventListener('pointerdown', (event) => {
            if(event.button !== 0) return;
            longPressTriggered = false;
            clearPressTimer();
            pressTimer = window.setTimeout(() => {
                longPressTriggered = true;
                primeAudioFromGesture();
                openMuteModeChooser(button);
            }, LONG_PRESS_MS);
        });

        button.addEventListener('pointerup', clearPressTimer);
        button.addEventListener('pointercancel', clearPressTimer);
        button.addEventListener('pointerleave', clearPressTimer);

        button.addEventListener('click', () => {
            if(longPressTriggered) {
                longPressTriggered = false;
                return;
            }
            primeAudioFromGesture();
            const muted = toggleMuted();
            updateAudioToggleButton(button);
            if(!muted) {
                playSfx('toggleOn');
            }
        });
    }
}

export function playSfx(eventName, payload = {}) {
    const len = Math.max(3, Math.min(7, Number(payload.length) || 3));
    const isPlayer = payload.isPlayer !== false;

    switch(eventName) {
        case 'uiClick':
            playPattern([[0, 640, 0.07, 0.7, 'triangle']]);
            break;
        case 'toggleOn':
            playPattern([
                [0, 480, 0.06, 0.8, 'triangle'],
                [0.05, 720, 0.09, 1, 'triangle']
            ]);
            break;
        case 'swap':
            playPattern([
                [0, 380, 0.045, 0.7, 'square'],
                [0.04, 460, 0.045, 0.55, 'square']
            ]);
            break;
        case 'invalid':
            playPattern([
                [0, 220, 0.07, 0.75, 'sawtooth'],
                [0.04, 170, 0.08, 0.65, 'sawtooth']
            ]);
            break;
        case 'match': {
            const type = payload.matchType || 'color';
            const base = type === 'skull' ? 210 : type === 'combat' ? 300 : 520;
            const wave = type === 'color' ? 'triangle' : 'square';
            playPattern([
                [0, base, 0.06, 0.7, wave],
                [0.05, base + len * 20, 0.09, 0.9, wave]
            ]);
            break;
        }
        case 'turnBonus':
            playPattern([
                [0, 520, 0.06, 0.7, 'triangle'],
                [0.05, 700, 0.06, 0.8, 'triangle'],
                [0.1, 900, 0.08, 1, 'triangle']
            ]);
            break;
        case 'spellCast':
            playPattern([
                [0, 430, 0.05, 0.55, 'sine'],
                [0.03, 560, 0.08, 0.8, 'triangle']
            ]);
            break;
        case 'spellHit':
            playPattern([
                [0, isPlayer ? 760 : 300, 0.06, 0.75, 'square'],
                [0.035, isPlayer ? 620 : 220, 0.08, 0.7, 'sawtooth']
            ]);
            break;
        case 'heal':
            playPattern([
                [0, 430, 0.07, 0.65, 'sine'],
                [0.05, 560, 0.08, 0.8, 'sine'],
                [0.11, 720, 0.08, 0.95, 'sine']
            ]);
            break;
        case 'weaponHit':
            playPattern([
                [0, isPlayer ? 210 : 180, 0.04, 0.8, 'square'],
                [0.03, isPlayer ? 150 : 130, 0.09, 0.75, 'sawtooth']
            ]);
            break;
        case 'victory':
            playPattern([
                [0, 520, 0.08, 0.75, 'triangle'],
                [0.08, 660, 0.08, 0.85, 'triangle'],
                [0.16, 880, 0.12, 1, 'triangle']
            ]);
            break;
        case 'defeat':
            playPattern([
                [0, 320, 0.1, 0.7, 'sawtooth'],
                [0.08, 240, 0.12, 0.85, 'sawtooth'],
                [0.18, 160, 0.18, 0.95, 'triangle']
            ]);
            break;
        default:
            playPattern([[0, 500, 0.05, 0.6, 'sine']]);
            break;
    }
}
