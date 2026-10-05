// Options d'affichage et de performance (menu Options), mémorisées par appareil dans localStorage.
//  - manaFlight : particules de mana qui rejoignent la banque (manaFlight.js) ;
//  - effects    : 'auto' | 'low' | 'normal' | 'high' — niveau d'effets visuels ('auto' se règle sur l'appareil) ;
//  - speed      : 'slow' | 'normal' | 'fast' — durée des animations de combat et pauses entre les tours.
// Purement visuel : aucune de ces options ne change les règles du jeu.

export const OPTIONS_STORAGE_KEY = 'match3quest.options';
export const OPTION_DEFAULTS = { manaFlight: true, effects: 'auto', speed: 'normal' };
const CHOICES = { effects: ['auto', 'low', 'normal', 'high'], speed: ['slow', 'normal', 'fast'] };
const SPEED_FACTOR = { slow: 1.4, normal: 1, fast: 0.6 };

let current = { ...OPTION_DEFAULTS };

function load() {
    try {
        const raw = JSON.parse(localStorage.getItem(OPTIONS_STORAGE_KEY) || '{}');
        Object.keys(OPTION_DEFAULTS).forEach(k => { if (isValid(k, raw[k])) current[k] = raw[k]; });
    } catch (e) { /* stockage indisponible : valeurs par défaut */ }
}

function isValid(key, value) {
    if (typeof OPTION_DEFAULTS[key] === 'boolean') return typeof value === 'boolean';
    return CHOICES[key]?.includes(value) === true;
}

export function getOption(key) { return current[key]; }

export function setOption(key, value) {
    if (!(key in OPTION_DEFAULTS) || !isValid(key, value)) return false;
    current[key] = value;
    try { localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(current)); } catch (e) { /* ignoré */ }
    applyOptions();
    return true;
}

// Niveau d'effets réellement appliqué : 'low' | 'normal' | 'high'.
export function effectsLevel() {
    if (current.effects !== 'auto') return current.effects;
    try {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'low';
        const cores = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory; // Go (indéfini sur certains navigateurs)
        if (cores <= 4 || (memory && memory <= 2)) return 'low';
        if (cores >= 8 && memory && memory >= 6) return 'high';
    } catch (e) { /* détection impossible */ }
    return 'normal';
}

// Multiplicateur appliqué aux durées d'animation et aux pauses (1 = normal).
export function animationFactor() { return SPEED_FACTOR[current.speed] || 1; }

// Nombre maximal de particules de mana par match, selon le niveau d'effets.
export function maxManaParticles() { return { low: 3, normal: 6, high: 10 }[effectsLevel()]; }

export function applyOptions() {
    if (typeof document === 'undefined' || !document.body) return;
    const level = effectsLevel();
    document.body.classList.toggle('fx-low', level === 'low');
    document.body.classList.toggle('fx-high', level === 'high');
}

load();
