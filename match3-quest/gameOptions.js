// Options d'affichage et de performance (menu Options), mémorisées par appareil dans localStorage.
//  - manaFlight : particules de qì qui rejoignent la banque (manaFlight.js) ;
//  - effects    : 'auto' | 'low' | 'normal' | 'high' — niveau d'effets visuels ('auto' se règle sur l'appareil) ;
//  - speed      : 'slow' | 'normal' | 'fast' — durée des animations de combat et pauses entre les tours ;
//  - vibration  : vibrations du téléphone (dégâts subis, onde de la perception du qì), désactivables.
// Accessibilité :
//  - textSize   : 'normal' | 'large' | 'xlarge' — taille du texte des menus, de la fiche des combattants et du journal ;
//  - shapes     : symboles en plus des couleurs (tuiles, qì, camps) pour ne pas dépendre de la seule couleur ;
//  - animations : false coupe animations et transitions (les pauses de combat restent, raccourcies) ;
//  - reduceFx   : réduit les effets visuels (équivaut au niveau d'effets « Économe », sans lueurs ni secousses).
// Difficulté des ennemis :
//  - aiDifficulty : 'auto' | 'easy' | 'normal' | 'hard' | 'expert' (enemyAI.js). 'auto' (défaut) adapte la qualité des décisions au
//    niveau de l'ennemi, de façon bornée ; un palier fixe est appliqué tel quel à chaque combat (jamais de bonus de statistiques).
// Les autres options sont purement visuelles : elles ne changent pas les règles du jeu.

export const OPTIONS_STORAGE_KEY = 'match3quest.options';
export const OPTION_DEFAULTS = { manaFlight: true, effects: 'auto', speed: 'normal', vibration: true, textSize: 'normal', shapes: false, animations: true, reduceFx: false, aiDifficulty: 'auto' };
const CHOICES = { effects: ['auto', 'low', 'normal', 'high'], speed: ['slow', 'normal', 'fast'], textSize: ['normal', 'large', 'xlarge'], aiDifficulty: ['auto', 'easy', 'normal', 'hard', 'expert'] };
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
    if (current.reduceFx) return 'low';
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
export function animationFactor() { return (SPEED_FACTOR[current.speed] || 1) * (current.animations ? 1 : 0.3); }

// Nombre maximal de particules de qì par match, selon le niveau d'effets.
export function maxManaParticles() { return { low: 3, normal: 6, high: 10 }[effectsLevel()]; }

// Fait vibrer l'appareil (durée en ms ou motif), sauf si l'option « Vibrations » est coupée ou si l'appareil ne sait pas vibrer.
// `shakeIfUnsupported` : sur un appareil sans vibreur, secoue l'écran à la place (dégâts subis).
// Retourne true si une vibration a été demandée.
export function vibrate(pattern, shakeIfUnsupported = false) {
    if (!current.vibration) return false;
    try {
        if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') { if (shakeIfUnsupported) shake(); return false; }
        const ok = navigator.vibrate(pattern) !== false;
        if (!ok) notifyBlocked(); else vibrationBlocked = false;
        return ok;
    } catch (e) { return false; }   // vibration refusée (pas de geste utilisateur, mode économie…)
}

// Depuis Chrome 60, navigator.vibrate() exige un geste de l'utilisateur (sinon il renvoie false) : tant qu'il n'a rien touché, les vibrations
// déclenchées par le jeu (dégâts, ondes) sont ignorées. Le premier geste (toucher, clic, touche) les arme ; si le navigateur les refuse
// quand même, l'événement `m3:vibration-blocked` invite à les réactiver d'un toucher (main.js).
let vibrationBlocked = false, lastBlockedNotice = 0;
export const isVibrationBlocked = () => vibrationBlocked;
function notifyBlocked() {
    vibrationBlocked = true;
    const now = Date.now();
    if (typeof window === 'undefined' || now - lastBlockedNotice < 60000) return;
    lastBlockedNotice = now;
    window.dispatchEvent(new Event('m3:vibration-blocked'));
}

// À appeler DANS un geste de l'utilisateur : une micro-vibration qui valide l'autorisation. Retourne true si elle est accordée.
export function armVibration() {
    if (!current.vibration || !canVibrate()) return false;
    try {
        const ok = navigator.vibrate(1) !== false;
        if (ok) vibrationBlocked = false;
        return ok;
    } catch (e) { return false; }
}

// L'appareil sait-il vibrer ? (Absent sur iPhone / iPad et Firefox ordinateur : l'API Vibration n'y existe pas.)
export function canVibrate() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

// À défaut de vibreur : une brève secousse de l'écran (classe `shake` du body, style.css) à la place.
function shake() {
    if (typeof document === 'undefined' || !document.body || effectsLevel() === 'low') return;
    document.body.classList.remove('shake');
    void document.body.offsetWidth;   // relance l'animation
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 320);
}

export function applyOptions() {
    if (typeof document === 'undefined' || !document.body) return;
    const level = effectsLevel();
    document.body.classList.toggle('fx-low', level === 'low');
    document.body.classList.toggle('fx-high', level === 'high' && !current.reduceFx);
    const b = document.body.classList;
    b.toggle('text-large', current.textSize === 'large');
    b.toggle('text-xlarge', current.textSize === 'xlarge');
    b.toggle('a11y-shapes', current.shapes);
    b.toggle('no-anim', !current.animations);
    b.toggle('fx-reduced', current.reduceFx);
}

load();
// Chaque premier geste de la page arme les vibrations (écouteurs ôtés dès qu'ils ont réussi).
if (typeof window !== 'undefined' && window.addEventListener) {
    const arm = () => { if (armVibration()) ['pointerdown', 'touchend', 'keydown', 'click'].forEach(t => window.removeEventListener(t, arm, true)); };
    ['pointerdown', 'touchend', 'keydown', 'click'].forEach(t => window.addEventListener(t, arm, true));
}
