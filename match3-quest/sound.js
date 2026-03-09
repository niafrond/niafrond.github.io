const AUDIO_SETTINGS_KEY = 'match3quest.audio.settings';

const defaultSettings = {
    muted: false,
    mutedMusic: false,
    mutedSfx: false,
    volume: 0.6
};

let settings = { ...defaultSettings };
let audioContext = null;
let ambientMasterGain = null;
let ambientSchedulerId = null;
let ambientRunning = false;
let ambientNextNoteTime = 0;
let ambientStepIndex = 0;
let combatMusicEnabled = false;
let audioPrimed = false;

const AMBIENT_MEASURE = 2.4;
const AMBIENT_SCHEDULE_AHEAD = 1.4;
const AMBIENT_ROOTS = [146.83, 174.61, 130.81, 164.81];
const AMBIENT_CHORD_RATIOS = [1, 1.2, 1.5];
const AMBIENT_ARP_RATIOS = [1, 1.125, 1.333, 1.5, 1.8];
const LONG_PRESS_MS = 550;

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

function clampVolume(v) {
    return Math.max(0, Math.min(1, Number.isFinite(v) ? v : defaultSettings.volume));
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

    const title = document.createElement('h3');
    title.textContent = 'Mode audio';
    title.style.margin = '0 0 8px';
    title.style.fontSize = '1.05rem';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Choisis ce que tu veux couper pendant le combat.';
    subtitle.style.margin = '0 0 14px';
    subtitle.style.opacity = '0.85';
    subtitle.style.fontSize = '0.92rem';

    const options = [
        { mode: 'music', label: 'Couper la musique', hint: 'Garde les effets audio' },
        { mode: 'sfx', label: 'Couper les effets', hint: 'Garde la loop d ambiance' },
        { mode: 'all', label: 'Couper les deux', hint: 'Silence total' },
        { mode: 'none', label: 'Tout activer', hint: 'Loop + effets audio' }
    ];

    const currentMode = getMuteMode();
    const buttonWrap = document.createElement('div');
    buttonWrap.style.display = 'grid';
    buttonWrap.style.gap = '8px';

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
    panel.appendChild(buttonWrap);
    panel.appendChild(footer);
    overlay.appendChild(panel);

    overlay.addEventListener('click', (event) => {
        if(event.target === overlay) {
            closeModal();
        }
    });

    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeyDown);
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

function ambientVoice(ctx, frequency, startAt, duration, gainValue, type = 'triangle') {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, frequency), startAt);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 8, startAt);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200 + Math.random() * 900, startAt);
    filter.Q.setValueAtTime(0.9, startAt);

    const attack = Math.min(0.7, duration * 0.4);
    const releaseStart = Math.max(startAt + attack, startAt + duration - 0.8);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), startAt + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ambientMasterGain || ctx.destination);

    osc.start(startAt);
    osc.stop(startAt + duration + 0.8);
}

function ensureAmbientNodes(ctx) {
    if(ambientMasterGain) return;
    ambientMasterGain = ctx.createGain();
    ambientMasterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    ambientMasterGain.connect(ctx.destination);
}

function getAmbientTargetGain() {
    return clampVolume(settings.volume * 0.70);
}

function scheduleAmbientChunk(ctx) {
    while(ambientNextNoteTime < ctx.currentTime + AMBIENT_SCHEDULE_AHEAD) {
        const root = AMBIENT_ROOTS[ambientStepIndex % AMBIENT_ROOTS.length];

        AMBIENT_CHORD_RATIOS.forEach((ratio, idx) => {
            ambientVoice(
                ctx,
                root * ratio,
                ambientNextNoteTime + idx * 0.02,
                AMBIENT_MEASURE * 0.95,
                0.028 + idx * 0.008,
                idx === 0 ? 'sine' : 'triangle'
            );
        });

        const arpStart = ambientNextNoteTime + 0.18;
        for(let i = 0; i < 4; i++) {
            const ratio = AMBIENT_ARP_RATIOS[(ambientStepIndex + i) % AMBIENT_ARP_RATIOS.length];
            ambientVoice(
                ctx,
                root * ratio * 2,
                arpStart + i * 0.32,
                0.38,
                0.02,
                'triangle'
            );
        }

        if(ambientStepIndex % 3 === 2) {
            ambientVoice(ctx, root * 3, ambientNextNoteTime + 1.35, 0.55, 0.018, 'sine');
        }

        ambientStepIndex += 1;
        ambientNextNoteTime += AMBIENT_MEASURE;
    }
}

function startAmbientLoop() {
    if(isMusicMuted() || !combatMusicEnabled) return;

    const ctx = getAudioContext({ allowCreate: false });
    if(!ctx) return;

    if(ctx.state === 'suspended') {
        ctx.resume().then(() => {
            if(!isMusicMuted() && combatMusicEnabled) {
                startAmbientLoop();
            }
        }).catch(() => {});
        return;
    }

    ensureAmbientNodes(ctx);

    const now = ctx.currentTime;
    ambientMasterGain.gain.cancelScheduledValues(now);
    ambientMasterGain.gain.setValueAtTime(Math.max(0.0001, ambientMasterGain.gain.value), now);
    ambientMasterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, getAmbientTargetGain()), now + 1.1);

    if(ambientRunning) return;

    ambientRunning = true;
    ambientStepIndex = 0;
    ambientNextNoteTime = now + 0.08;
    scheduleAmbientChunk(ctx);

    ambientSchedulerId = window.setInterval(() => {
        if(!audioContext || audioContext.state !== 'running' || isMusicMuted()) return;
        scheduleAmbientChunk(audioContext);
    }, 650);
}

function stopAmbientLoop() {
    const ctx = audioContext;

    if(ambientSchedulerId !== null) {
        window.clearInterval(ambientSchedulerId);
        ambientSchedulerId = null;
    }

    ambientRunning = false;

    if(!ctx || !ambientMasterGain) return;
    const now = ctx.currentTime;
    ambientMasterGain.gain.cancelScheduledValues(now);
    ambientMasterGain.gain.setValueAtTime(Math.max(0.0001, ambientMasterGain.gain.value), now);
    ambientMasterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
}

function syncAmbientState() {
    if(isMusicMuted() || !combatMusicEnabled) {
        stopAmbientLoop();
        return;
    }
    startAmbientLoop();
}

export function setCombatMusicEnabled(enabled) {
    combatMusicEnabled = Boolean(enabled);
    syncAmbientState();
}

export function primeAudioFromGesture() {
    audioPrimed = true;
    resumeAudioContext({ allowCreate: true });
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
    const baseGain = clampVolume((options.gain ?? 1) * settings.volume * 0.12);

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
        ? 'Tout coupe (clic: tout activer, maintien: choisir mode)'
        : mode === 'music'
            ? 'Musique coupee (maintien: choisir mode)'
            : mode === 'sfx'
                ? 'Effets coupes (maintien: choisir mode)'
                : 'Son actif (clic: tout couper, maintien: choisir mode)';

    button.textContent = icon;
    button.setAttribute('aria-pressed', mode === 'all' ? 'true' : 'false');
    button.title = title;
}

export function initializeAudioUI(button) {
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
