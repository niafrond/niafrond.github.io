import { icon } from "./icons.js";
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

// Contexte audio partagé (créé après un geste utilisateur) : sert aussi à la musique procédurale (music.js).
export const getSharedAudioContext = () => getAudioContext({ allowCreate: true });

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
        case 'combatStart': case 'bossStart': {
            // Jingle d'entrée en combat (façon Pokémon) : martèlement alterné rapide, montée pentatonique, note tenue.
            // Durée ≈ COMBAT_INTRO_MS : la musique de combat démarre juste après (voir main.js).
            const boss = eventName === 'bossStart';
            const lo = boss ? 164.8 : 329.6, hi = boss ? 196 : 392;
            const wave = boss ? 'sawtooth' : 'square';
            const p = [];
            const hits = boss ? 8 : 6;
            for (let i = 0; i < hits; i++) p.push([i * 0.075, i % 2 ? hi : lo, 0.06, 0.8, wave]);
            const t0 = hits * 0.075 + 0.05;
            const run = boss ? [220, 261.6, 329.6, 392, 440, 523.3] : [440, 523.3, 659.3, 784];
            run.forEach((f, i) => p.push([t0 + i * 0.09, f, 0.1, 0.85, wave]));
            const tEnd = t0 + run.length * 0.09;
            const top = run[run.length - 1];
            p.push([tEnd, top, 0.45, 1, 'triangle'], [tEnd, top / 2, 0.45, 0.8, wave], [tEnd, top * 1.5, 0.45, 0.5, 'triangle']);
            p.push([0, 90, 0.18, 1, 'sine'], [tEnd, 70, 0.25, 1, 'sine']);
            playPattern(p, { gain: boss ? 1.1 : 1 });
            break;
        }
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
        case 'battleStart': // petit motif de début de combat
            playPattern([
                [0,    330, 0.09, 0.8, 'square'],
                [0.1,  330, 0.09, 0.8, 'square'],
                [0.2,  440, 0.09, 0.9, 'square'],
                [0.3,  523, 0.18, 1,   'square'],
                [0.3,  262, 0.18, 0.5, 'triangle']
            ]);
            break;
        case 'bossStart': // fanfare plus grave et plus longue pour les boss
            playPattern([
                [0,    196, 0.16, 0.9, 'sawtooth'],
                [0.18, 196, 0.16, 0.9, 'sawtooth'],
                [0.36, 233, 0.16, 0.95, 'sawtooth'],
                [0.54, 294, 0.16, 1,   'sawtooth'],
                [0.72, 392, 0.32, 1,   'square'],
                [0.72, 196, 0.32, 0.7, 'triangle'],
                [1.1,  370, 0.45, 1,   'square'],
                [1.1,  185, 0.45, 0.7, 'triangle']
            ]);
            break;
        case 'introJingle': // lent et mystérieux, façon chant du Fusang
            playPattern([
                [0,   262, 0.5, 0.6, 'triangle'], [0.6, 330, 0.5, 0.6, 'triangle'],
                [1.2, 392, 0.5, 0.7, 'triangle'], [1.8, 523, 0.9, 0.8, 'triangle'],
                [3.5, 392, 0.2, 0.7, 'square'],   [3.8, 392, 0.2, 0.7, 'square'],
                [4.1, 494, 0.2, 0.8, 'square'],   [4.4, 587, 0.6, 0.9, 'square'],
                [6.5, 392, 0.3, 0.9, 'square'],   [6.9, 523, 0.3, 0.9, 'square'],
                [7.3, 659, 0.9, 1,   'square'],   [7.3, 330, 0.9, 0.5, 'triangle']
            ]);
            break;
        case 'endingJingle': // berceuse apaisée
            playPattern([
                [0,   392, 0.6, 0.6, 'sine'], [0.7, 440, 0.6, 0.6, 'sine'],
                [1.4, 523, 0.9, 0.7, 'sine'], [2.6, 440, 0.6, 0.6, 'sine'],
                [3.3, 392, 0.6, 0.6, 'sine'], [4.0, 330, 1.2, 0.7, 'sine'],
                [6.0, 392, 0.6, 0.6, 'sine'], [6.7, 523, 0.6, 0.7, 'sine'],
                [7.4, 659, 1.0, 0.8, 'sine'], [8.8, 523, 0.8, 0.7, 'sine'],
                [9.8, 392, 1.8, 0.7, 'sine'], [9.8, 196, 1.8, 0.4, 'triangle']
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
