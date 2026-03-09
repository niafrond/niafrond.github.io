const AUDIO_SETTINGS_KEY = 'match3quest.audio.settings';

const defaultSettings = {
    muted: false,
    volume: 0.6
};

let settings = { ...defaultSettings };
let audioContext = null;
let unlockHandlersBound = false;

function loadSettings() {
    try {
        const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
        if(!raw) return;
        const parsed = JSON.parse(raw);
        settings.muted = Boolean(parsed?.muted);
        const parsedVolume = Number(parsed?.volume);
        if(Number.isFinite(parsedVolume) && parsedVolume > 0 && parsedVolume <= 1) {
            settings.volume = parsedVolume;
        }
    } catch {
        settings = { ...defaultSettings };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Ignore storage errors (private mode or quota).
    }
}

function getAudioContext() {
    if(typeof window === 'undefined') return null;
    if(audioContext) return audioContext;

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if(!Ctor) return null;

    audioContext = new Ctor();
    return audioContext;
}

function resumeAudioContext() {
    const ctx = getAudioContext();
    if(!ctx) return;
    if(ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }
}

function bindUnlockHandlers() {
    if(unlockHandlersBound) return;
    unlockHandlersBound = true;

    const tryUnlock = () => {
        resumeAudioContext();
        if(audioContext && audioContext.state === 'running') {
            window.removeEventListener('pointerdown', tryUnlock);
            window.removeEventListener('keydown', tryUnlock);
            window.removeEventListener('touchstart', tryUnlock);
            unlockHandlersBound = false;
        }
    };

    window.addEventListener('pointerdown', tryUnlock, { passive: true });
    window.addEventListener('keydown', tryUnlock, { passive: true });
    window.addEventListener('touchstart', tryUnlock, { passive: true });
}

function clampVolume(v) {
    return Math.max(0, Math.min(1, Number.isFinite(v) ? v : defaultSettings.volume));
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

function playPattern(pattern, options = {}) {
    if(settings.muted) return;

    const ctx = getAudioContext();
    if(!ctx) return;
    if(ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }

    const baseTime = ctx.currentTime + 0.01;
    const baseGain = clampVolume((options.gain ?? 1) * settings.volume * 0.12);

    pattern.forEach((step) => {
        const [delay, frequency, duration, relGain = 1, wave = 'sine'] = step;
        tone(ctx, frequency, baseTime + delay, duration, baseGain * relGain, wave);
    });
}

export function isMuted() {
    return settings.muted;
}

export function setMuted(muted) {
    settings.muted = Boolean(muted);
    saveSettings();
}

export function toggleMuted() {
    setMuted(!settings.muted);
    return settings.muted;
}

export function updateAudioToggleButton(button) {
    if(!button) return;
    const muted = isMuted();
    button.textContent = muted ? '🔇' : '🔊';
    button.setAttribute('aria-pressed', muted ? 'true' : 'false');
    button.title = muted ? 'Activer les bruitages' : 'Passer en mode silencieux';
}

export function initializeAudioUI(button) {
    loadSettings();
    bindUnlockHandlers();
    updateAudioToggleButton(button);

    if(button) {
        button.addEventListener('click', () => {
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
